import * as XLSX from 'xlsx';
import { LkptiDetail, LkptiCategoryCode, LkptiBackupStrategy, LkptiOwnership, Deliverable, Asset, AssetCategory, DeliverableSegment, DeliverableStatus } from '../types';
import { RPTI_CATEGORY_LABELS, isLiveStatusId, resolveAssetCategory } from './rpti';

export const LKPTI_CATEGORY_CODES: LkptiCategoryCode[] = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '49'];
const LKPTI_CATEGORY_CODE_SET = new Set<string>(LKPTI_CATEGORY_CODES);

export function isLkptiCategoryCode(code: string): code is LkptiCategoryCode {
  return LKPTI_CATEGORY_CODE_SET.has(code);
}

// Converts Selara's internal ISO date (YYYY-MM-DD) to the LKPTI form's dd-mm-yyyy.
export function toDdMmYyyy(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

export interface GenerateLkptiDetailsInput {
  deliverableSegments: DeliverableSegment[];
  deliverableStatuses: DeliverableStatus[];
  deliverables: Deliverable[];
  assets: Asset[];
  assetCategories: AssetCategory[];
  // Prior generation output (and/or imported rows) to merge into — see
  // requirement-specs/lkpti-import-onboarding.md §5. When a row already exists for
  // a deliverable, only its cascade-derived fields are refreshed; its 7 manual-only
  // fields and goLiveDate are carried over untouched.
  existingDetails?: LkptiDetail[];
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
 * a year.
 *
 * Merge-preserving, not wipe-and-rebuild (see requirement-specs/lkpti-import-onboarding.md
 * §5): a deliverable with no existing row gets a brand-new, fully cascade-filled one; a
 * deliverable that already has a row (from a prior generate, manual entry, or an LKPTI
 * import) keeps its id, its 7 manual-only fields, and its goLiveDate untouched — only the
 * cascade-derived fields (categoryCode, developer, dcCity/dcCountry, drCity/drCountry,
 * functionDescription) are refreshed. A deliverable that no longer qualifies drops out of
 * the result even if it had an existing row.
 */
export function generateLkptiDetails(
  input: GenerateLkptiDetailsInput,
): LkptiDetail[] {
  const { deliverableSegments, deliverableStatuses, deliverables, assets, assetCategories, existingDetails = [] } = input;

  const results: LkptiDetail[] = [];
  for (const deliverable of deliverables) {
    if ((deliverable.type ?? 'application') !== 'application') continue;

    const hasLiveSegment = deliverableSegments.some(seg =>
      seg.deliverableId === deliverable.id && isLiveStatusId(seg.status, deliverableStatuses)
    );
    if (!hasLiveSegment) continue;

    const category = resolveAssetCategory(deliverable, assets, assetCategories);
    const resolvedCategoryCode = deliverable.categoryCode ?? category?.categoryCode;

    const cascadedFields = {
      categoryCode: resolvedCategoryCode && isLkptiCategoryCode(resolvedCategoryCode) ? resolvedCategoryCode : undefined,
      developer: deliverable.developer === 'inhouse' ? 'inhouse' : undefined,
      dcCity: deliverable.dcCity ?? category?.dcCity,
      dcCountry: deliverable.dcCountry ?? category?.dcCountry,
      drCity: deliverable.drCity ?? category?.drCity,
      drCountry: deliverable.drCountry ?? category?.drCountry,
      functionDescription: deliverable.description,
    };

    const existing = existingDetails.find(d => d.targetId === deliverable.id);
    results.push(existing
      ? { ...existing, ...cascadedFields }
      : {
          id: `lkpti-gen-${deliverable.id}`,
          targetId: deliverable.id,
          ...cascadedFields,
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

export const LKPTI_BACKUP_STRATEGY_LABELS: Record<LkptiBackupStrategy, string> = {
  HA_ACTIVE_ACTIVE: 'High Availability Active - Active',
  HA_ACTIVE_PASSIVE: 'High Availability Active - Passive',
  BACKUP_REALTIME: 'Backup Realtime',
  BACKUP_PERIODIC: 'Backup Periodically',
};

export const LKPTI_OWNERSHIP_LABELS: Record<LkptiOwnership, string> = {
  LEASE: 'Sewa',
  OUTRIGHT_PURCHASE: 'Beli Putus',
};

export const LKPTI_SHEET_NAME = 'LKPTI Format 3.2.6';

export const LKPTI_EXPORT_HEADERS = [
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
  const headers = LKPTI_EXPORT_HEADERS;

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
      detail.backupStrategy ? LKPTI_BACKUP_STRATEGY_LABELS[detail.backupStrategy] : '',
      detail.systemOwner ?? '',
      detail.developer ?? '',
      detail.goLiveDate ?? '',
      detail.ownership ? LKPTI_OWNERSHIP_LABELS[detail.ownership] : '',
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, LKPTI_SHEET_NAME);
  XLSX.writeFile(wb, `lkpti-report-${new Date().toISOString().split('T')[0]}.xlsx`);
}
