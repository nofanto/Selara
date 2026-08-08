import * as XLSX from 'xlsx';
import { RptiDetail, RptiCategoryCode, RptiQuarter, Initiative, Deliverable, Asset, DeliverableSegment, DeliverableStatus } from '../types';

export const RPTI_CATEGORY_LABELS: Record<RptiCategoryCode, string> = {
  '01': 'Customer management',
  '02': 'Third-party funds (current accounts, savings, deposits)',
  '03': 'Credit / financing',
  '04': 'General Ledger (GL)',
  '05': 'Payments',
  '06': 'Digital services',
  '07': 'Treasury',
  '08': 'Trade finance',
  '09': 'AML-CFT and PPPSPM',
  '10': 'Management information/reporting systems',
  '11': 'Risk management',
  '12': 'Internal management',
  '49': 'Other deliverables',
  '51': 'Data Center / Disaster Recovery Center',
  '52': 'Servers and/or platforms',
  '53': 'Data communication network',
  '54': 'Security systems',
  '99': 'Other infrastructure',
};

const LIVE_STATUS_FALLBACK_ID = 'appstatus-in-production';
const LIVE_STATUS_FALLBACK_PATTERN = /production|live/i;

export function deriveQuarterFromDate(iso: string): RptiQuarter {
  const month = Number(iso.slice(5, 7));
  if (month <= 3) return 'Q1';
  if (month <= 6) return 'Q2';
  if (month <= 9) return 'Q3';
  return 'Q4';
}

function isLiveStatusId(statusId: string, deliverableStatuses: DeliverableStatus[]): boolean {
  const status = deliverableStatuses.find(s => s.id === statusId);
  if (status) return !!status.isLiveStatus || (!deliverableStatuses.some(s => s.isLiveStatus) && (statusId === LIVE_STATUS_FALLBACK_ID || LIVE_STATUS_FALLBACK_PATTERN.test(status.name)));
  // No matching DeliverableStatus record (e.g. legacy default id with no record) — fall back to id/name pattern.
  return statusId === LIVE_STATUS_FALLBACK_ID;
}

const EXCLUDED_STATUS_FALLBACK_IDS = new Set(['appstatus-sunset', 'appstatus-out-of-support', 'appstatus-retired']);
const EXCLUDED_STATUS_PATTERN = /sunset|out.of.support|retired|decommission/i;

type SegmentKind = 'new' | 'live' | 'excluded';

// Classifies a segment's status for RPTI generation. Live status wins first (it's the
// only classification with a real data signal, DeliverableStatus.isLiveStatus); anything
// matching a known decommission-ish id/name is excluded; everything else is treated as a
// pre-launch ("new") phase — see requirement-specs/rpti-auto-generation.md.
function classifySegmentKind(statusId: string, deliverableStatuses: DeliverableStatus[]): SegmentKind {
  if (isLiveStatusId(statusId, deliverableStatuses)) return 'live';
  const status = deliverableStatuses.find(s => s.id === statusId);
  const name = status?.name ?? '';
  if (EXCLUDED_STATUS_FALLBACK_IDS.has(statusId) || EXCLUDED_STATUS_PATTERN.test(name)) return 'excluded';
  return 'new';
}

/**
 * Generates RptiDetail rows for a single report year from DeliverableSegment data —
 * see requirement-specs/rpti-auto-generation.md for the full rule. Wipe-and-rebuild:
 * callers replace the existing rptiDetails for the year with this function's output,
 * there's no reconciliation with prior manual edits (v1).
 */
export function generateRptiDetails(
  deliverableSegments: DeliverableSegment[],
  deliverableStatuses: DeliverableStatus[],
  initiatives: Initiative[],
  reportYear: number,
): RptiDetail[] {
  // Overlap, not "starts in": a segment qualifies if any part of its
  // [startDate, endDate] range falls within the report year, even if it
  // started in an earlier year or continues into the next one.
  const yearStart = `${reportYear}-01-01`;
  const yearEnd = `${reportYear}-12-31`;
  const overlapsReportYear = (seg: DeliverableSegment) => seg.startDate <= yearEnd && seg.endDate >= yearStart;
  // Deleting an Initiative doesn't clean up DeliverableSegment.initiativeId, so a segment
  // can carry a dangling reference to an initiative that no longer exists — skip those.
  const initiativeIds = new Set(initiatives.map(i => i.id));

  const qualifying = deliverableSegments
    .filter(seg => !!seg.initiativeId && initiativeIds.has(seg.initiativeId) && overlapsReportYear(seg))
    .map(seg => ({ segment: seg, kind: classifySegmentKind(seg.status, deliverableStatuses) }))
    .filter((s): s is { segment: DeliverableSegment; kind: 'new' | 'live' } => s.kind !== 'excluded');

  const groups = new Map<string, { segment: DeliverableSegment; kind: 'new' | 'live' }[]>();
  for (const item of qualifying) {
    const key = `${item.segment.initiativeId}::${item.segment.deliverableId}`;
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }

  const byStartDateAsc = (a: { segment: DeliverableSegment }, b: { segment: DeliverableSegment }) =>
    a.segment.startDate.localeCompare(b.segment.startDate);

  const results: RptiDetail[] = [];
  for (const [key, items] of groups) {
    const [initiativeId, deliverableId] = key.split('::');
    const newItems = items.filter(i => i.kind === 'new').sort(byStartDateAsc);
    const liveItems = items.filter(i => i.kind === 'live').sort(byStartDateAsc);

    const developmentType: RptiDetail['developmentType'] = newItems.length > 0 ? 'new' : 'upgrade';
    const anchor = newItems.length > 0
      ? (liveItems.length > 0 ? liveItems[liveItems.length - 1] : newItems[newItems.length - 1])
      : liveItems[liveItems.length - 1];

    results.push({
      id: `rpti-gen-${initiativeId}-${deliverableId}-${reportYear}`,
      initiativeId,
      targetType: 'deliverable',
      targetId: deliverableId,
      developmentType,
      plannedImplementationQuarter: deriveQuarterFromDate(anchor.segment.startDate),
      deliverableSegmentId: anchor.segment.id,
    });
  }

  return results;
}

/**
 * For a deliverable-target RptiDetail, find the initiative's lifecycle segment
 * on that deliverable whose status is "live" and suggest that segment's
 * planned implementation quarter. Returns {} when nothing matches, so the
 * caller falls back to manual entry.
 */
export function suggestDeliverableQuarter(
  detail: Pick<RptiDetail, 'initiativeId' | 'targetType' | 'targetId'>,
  segments: DeliverableSegment[],
  deliverableStatuses: DeliverableStatus[],
): { quarter?: RptiQuarter; segmentId?: string } {
  if (detail.targetType !== 'deliverable') return {};
  const candidates = segments
    .filter(s => s.deliverableId === detail.targetId && s.initiativeId === detail.initiativeId)
    .filter(s => isLiveStatusId(s.status, deliverableStatuses))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const match = candidates[0];
  if (!match) return {};
  return { quarter: deriveQuarterFromDate(match.startDate), segmentId: match.id };
}

export function resolveCost(detail: RptiDetail, initiative: Initiative | undefined): { capexAmount: number; opexAmount: number } {
  return {
    capexAmount: detail.capexAmount ?? initiative?.capex ?? 0,
    opexAmount: detail.opexAmount ?? initiative?.opex ?? 0,
  };
}

export function rptiCascadeOnInitiativeDelete(rptiDetails: RptiDetail[], initiativeId: string): RptiDetail[] {
  return rptiDetails.filter(r => r.initiativeId !== initiativeId);
}

export function rptiCascadeOnDeliverableDelete(rptiDetails: RptiDetail[], deliverableId: string): RptiDetail[] {
  return rptiDetails.filter(r => !(r.targetType === 'deliverable' && r.targetId === deliverableId));
}

export function rptiCascadeOnAssetDelete(rptiDetails: RptiDetail[], assetId: string): RptiDetail[] {
  return rptiDetails.filter(r => !(r.targetType === 'asset' && r.targetId === assetId));
}

export function rptiCascadeOnSegmentDelete(rptiDetails: RptiDetail[], segmentId: string): RptiDetail[] {
  return rptiDetails.map(r => r.deliverableSegmentId === segmentId ? { ...r, deliverableSegmentId: undefined } : r);
}

function formatPlace(city?: string, country?: string): string {
  return [city, country].filter(Boolean).join(', ');
}

/**
 * Builds the RPTI Format 3.1 report as a standalone Excel file — distinct
 * from the raw "RptiDetails" backup sheet included in the general workspace
 * export/import round-trip (src/lib/excel.ts).
 */
export function exportRptiReportToExcel(
  rptiDetails: RptiDetail[],
  initiatives: Initiative[],
  deliverables: Deliverable[],
  assets: Asset[],
  deliverableSegments: DeliverableSegment[] = [],
  deliverableStatuses: DeliverableStatus[] = [],
) {
  const headers = [
    'No.',
    'Nama Aplikasi/Infrastruktur Bank',
    'Deskripsi',
    'Kategori',
    'Jenis Pengembangan',
    'Pengembang',
    'PPJTI Pihak Terkait',
    'Lokasi Data Center',
    'Lokasi Disaster Recovery Center',
    'Waktu Rencana Implementasi',
    'Estimasi Biaya CapEx',
    'Estimasi Biaya OpEx',
    'Keterangan',
  ];

  const rows = rptiDetails.map((detail, index) => {
    const initiative = initiatives.find(i => i.id === detail.initiativeId);
    const targetName = detail.targetType === 'deliverable'
      ? deliverables.find(a => a.id === detail.targetId)?.name ?? ''
      : assets.find(a => a.id === detail.targetId)?.name ?? '';
    const suggestion = detail.plannedImplementationQuarter
      ?? suggestDeliverableQuarter(detail, deliverableSegments, deliverableStatuses).quarter
      ?? '';
    const { capexAmount, opexAmount } = resolveCost(detail, initiative);
    return [
      index + 1,
      targetName,
      initiative?.description ?? '',
      detail.categoryCode ? RPTI_CATEGORY_LABELS[detail.categoryCode] : '',
      detail.developmentType,
      detail.developer ?? '',
      detail.ppjtiRelatedParty ?? '',
      formatPlace(detail.dcCity, detail.dcCountry),
      formatPlace(detail.drCity, detail.drCountry),
      suggestion,
      capexAmount,
      opexAmount,
      detail.remarks ?? '',
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'RPTI Format 3.1');
  XLSX.writeFile(wb, `rpti-report-${new Date().toISOString().split('T')[0]}.xlsx`);
}
