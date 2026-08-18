import * as XLSX from 'xlsx';
import { LkptiDetail, LkptiCategoryCode, LkptiBackupStrategy, LkptiOwnership, Deliverable, Asset, AssetCategory, DeliverableSegment, DeliverableStatus } from '../types';
import { RPTI_CATEGORY_LABELS, isLiveStatusId, resolveAssetCategory } from './rpti';

export const LKPTI_CATEGORY_CODES: LkptiCategoryCode[] = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '49'];
const LKPTI_CATEGORY_CODE_SET = new Set<string>(LKPTI_CATEGORY_CODES);

function isLkptiCategoryCode(code: string): code is LkptiCategoryCode {
  return LKPTI_CATEGORY_CODE_SET.has(code);
}

// Converts Selara's internal ISO date (YYYY-MM-DD) to the LKPTI form's dd-mm-yyyy.
function toDdMmYyyy(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

export interface GenerateLkptiDetailsInput {
  deliverableSegments: DeliverableSegment[];
  deliverableStatuses: DeliverableStatus[];
  deliverables: Deliverable[];
  assets: Asset[];
  assetCategories: AssetCategory[];
}

/**
 * For a target Deliverable, finds its earliest live (in-production) segment and
 * suggests that segment's start date as the LKPTI go-live date. Returns undefined
 * when no live segment exists, so the caller falls back to manual entry.
 */
export function suggestGoLiveDate(
  targetId: string,
  segments: DeliverableSegment[],
  deliverableStatuses: DeliverableStatus[],
): string | undefined {
  const candidates = segments
    .filter(s => s.deliverableId === targetId && isLiveStatusId(s.status, deliverableStatuses))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const match = candidates[0];
  return match ? toDdMmYyyy(match.startDate) : undefined;
}

/**
 * Generates LkptiDetail rows for LKPTI Format 3.2.6 — see
 * requirement-specs/lkpti-integration.md §3 for the generation rule.
 * Unlike generateRptiDetails, this isn't scoped to a report year: it's a point-in-time
 * inventory of Deliverables that have actually gone live, not a plan of activity within
 * a year. Wipe-and-rebuild: callers replace all existing rows with this function's
 * output, same v1 no-reconciliation tradeoff as RPTI generation.
 */
export function generateLkptiDetails(
  input: GenerateLkptiDetailsInput,
): LkptiDetail[] {
  const { deliverableSegments, deliverableStatuses, deliverables, assets, assetCategories } = input;

  const results: LkptiDetail[] = [];
  for (const deliverable of deliverables) {
    if ((deliverable.type ?? 'application') !== 'application') continue;

    const hasLiveSegment = deliverableSegments.some(seg =>
      seg.deliverableId === deliverable.id && isLiveStatusId(seg.status, deliverableStatuses)
    );
    if (!hasLiveSegment) continue;

    const category = resolveAssetCategory(deliverable, assets, assetCategories);
    const resolvedCategoryCode = deliverable.categoryCode ?? category?.categoryCode;

    results.push({
      id: `lkpti-gen-${deliverable.id}`,
      targetId: deliverable.id,
      categoryCode: resolvedCategoryCode && isLkptiCategoryCode(resolvedCategoryCode) ? resolvedCategoryCode : undefined,
      developer: deliverable.developer === 'inhouse' ? 'inhouse' : undefined,
      dcCity: deliverable.dcCity ?? category?.dcCity,
      dcCountry: deliverable.dcCountry ?? category?.dcCountry,
      drCity: deliverable.drCity ?? category?.drCity,
      drCountry: deliverable.drCountry ?? category?.drCountry,
      functionDescription: deliverable.description,
      goLiveDate: suggestGoLiveDate(deliverable.id, deliverableSegments, deliverableStatuses),
    });
  }

  return results;
}

export function lkptiCascadeOnDeliverableDelete(
  details: LkptiDetail[],
  deliverableId: string,
): LkptiDetail[] {
  return details.filter(d => d.targetId !== deliverableId);
}

const BACKUP_STRATEGY_LABELS: Record<LkptiBackupStrategy, string> = {
  HA_ACTIVE_ACTIVE: 'High Availability Active - Active',
  HA_ACTIVE_PASSIVE: 'High Availability Active - Passive',
  BACKUP_REALTIME: 'Backup Realtime',
  BACKUP_PERIODIC: 'Backup Periodically',
};

const OWNERSHIP_LABELS: Record<LkptiOwnership, string> = {
  LEASE: 'Sewa',
  OUTRIGHT_PURCHASE: 'Beli Putus',
};

/**
 * Builds the LKPTI Format 3.2.6 report as a standalone Excel file, matching the
 * exact 1-15 column order and Indonesian headers mandated by
 * requirement-specs/lkpti-schema.md §8 — same self-contained,
 * single-report-download convention as exportRptiReportToExcel (src/lib/rpti.ts),
 * not routed through the general multi-entity workspace exporter (src/lib/excel.ts).
 */
export function exportLkptiReportToExcel(
  details: LkptiDetail[],
  deliverables: Deliverable[],
) {
  const headers = [
    'No.',
    'Kategori Aplikasi',
    'Nama Aplikasi',
    'Deskripsi Fungsi Aplikasi',
    'Platform',
    'Pangkalan Data',
    'Lokasi DC',
    'Penyelenggara DC',
    'Lokasi DRC',
    'Penyelenggara DRC',
    'Strategi Backup',
    'System Owner',
    'Pengembang Aplikasi',
    'Tanggal Implementasi (Go Live)',
    'Kepemilikan',
  ];

  const rows = details.map((detail, index) => {
    const deliverable = deliverables.find(d => d.id === detail.targetId);
    return [
      index + 1,
      detail.categoryCode ? `${detail.categoryCode} — ${RPTI_CATEGORY_LABELS[detail.categoryCode]}` : '',
      deliverable?.name ?? '',
      detail.functionDescription ?? '',
      detail.platform ?? '',
      detail.database ?? '',
      [detail.dcCity, detail.dcCountry].filter(Boolean).join(', '),
      detail.dcProvider ?? '',
      [detail.drCity, detail.drCountry].filter(Boolean).join(', '),
      detail.drcProvider ?? '',
      detail.backupStrategy ? BACKUP_STRATEGY_LABELS[detail.backupStrategy] : '',
      detail.systemOwner ?? '',
      detail.developer ?? '',
      detail.goLiveDate ?? '',
      detail.ownership ? OWNERSHIP_LABELS[detail.ownership] : '',
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'LKPTI Format 3.2.6');
  XLSX.writeFile(wb, `lkpti-report-${new Date().toISOString().split('T')[0]}.xlsx`);
}
