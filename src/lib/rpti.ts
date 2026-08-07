import * as XLSX from 'xlsx';
import { RptiDetail, RptiCategoryCode, RptiQuarter, Initiative, Application, Asset, ApplicationSegment, ApplicationStatus } from '../types';

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
  '49': 'Other applications',
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

function isLiveStatusId(statusId: string, applicationStatuses: ApplicationStatus[]): boolean {
  const status = applicationStatuses.find(s => s.id === statusId);
  if (status) return !!status.isLiveStatus || (!applicationStatuses.some(s => s.isLiveStatus) && (statusId === LIVE_STATUS_FALLBACK_ID || LIVE_STATUS_FALLBACK_PATTERN.test(status.name)));
  // No matching ApplicationStatus record (e.g. legacy default id with no record) — fall back to id/name pattern.
  return statusId === LIVE_STATUS_FALLBACK_ID;
}

/**
 * For an application-target RptiDetail, find the initiative's lifecycle segment
 * on that application whose status is "live" and suggest that segment's
 * planned implementation quarter. Returns {} when nothing matches, so the
 * caller falls back to manual entry.
 */
export function suggestApplicationQuarter(
  detail: Pick<RptiDetail, 'initiativeId' | 'targetType' | 'targetId'>,
  segments: ApplicationSegment[],
  applicationStatuses: ApplicationStatus[],
): { quarter?: RptiQuarter; segmentId?: string } {
  if (detail.targetType !== 'application') return {};
  const candidates = segments
    .filter(s => s.applicationId === detail.targetId && s.initiativeId === detail.initiativeId)
    .filter(s => isLiveStatusId(s.status, applicationStatuses))
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

export function rptiCascadeOnApplicationDelete(rptiDetails: RptiDetail[], applicationId: string): RptiDetail[] {
  return rptiDetails.filter(r => !(r.targetType === 'application' && r.targetId === applicationId));
}

export function rptiCascadeOnAssetDelete(rptiDetails: RptiDetail[], assetId: string): RptiDetail[] {
  return rptiDetails.filter(r => !(r.targetType === 'asset' && r.targetId === assetId));
}

export function rptiCascadeOnSegmentDelete(rptiDetails: RptiDetail[], segmentId: string): RptiDetail[] {
  return rptiDetails.map(r => r.applicationSegmentId === segmentId ? { ...r, applicationSegmentId: undefined } : r);
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
  applications: Application[],
  assets: Asset[],
  applicationSegments: ApplicationSegment[] = [],
  applicationStatuses: ApplicationStatus[] = [],
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
    const targetName = detail.targetType === 'application'
      ? applications.find(a => a.id === detail.targetId)?.name ?? ''
      : assets.find(a => a.id === detail.targetId)?.name ?? '';
    const suggestion = detail.plannedImplementationQuarter
      ?? suggestApplicationQuarter(detail, applicationSegments, applicationStatuses).quarter
      ?? '';
    const { capexAmount, opexAmount } = resolveCost(detail, initiative);
    return [
      index + 1,
      targetName,
      initiative?.description ?? '',
      RPTI_CATEGORY_LABELS[detail.categoryCode],
      detail.developmentType,
      detail.developer,
      detail.ppjtiRelatedParty,
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
