import * as XLSX from 'xlsx';
import { LkptiDetail, LkptiCategoryCode, LkptiBackupStrategy, LkptiOwnership, Deliverable, Asset, AssetCategory, DeliverableSegment, DeliverableStatus } from '../types';
import { RPTI_CATEGORY_LABELS, isLiveStatusId, resolveAssetCategory } from './rpti';

export const LKPTI_CATEGORY_CODES: LkptiCategoryCode[] = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '49'];
const LKPTI_CATEGORY_CODE_SET = new Set<string>(LKPTI_CATEGORY_CODES);

export function isLkptiCategoryCode(code: string): code is LkptiCategoryCode {
  return LKPTI_CATEGORY_CODE_SET.has(code);
}

/**
 * The inverse, for comparing a filed go-live against an as-at date. Returns undefined
 * for anything not well-formed: an unparseable date is `lkpti-golive-invalid`'s problem,
 * and this must not quietly discard a value for a defect it was not written to catch.
 * Both sides are zero-padded ISO, so lexicographic comparison is exact.
 */
function isoFromDdMmYyyy(value: string): string | undefined {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined;
}

// Converts Selara's internal ISO date (YYYY-MM-DD) to the LKPTI form's dd-mm-yyyy.
export function toDdMmYyyy(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

export interface GenerateLkptiDetailsInput {
  /** ISO date for the inventory's stated "as at" point, supplied by Reports. */
  asAtDate: string;
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
 * This is an inventory as at `asAtDate`: an application is present only while an
 * in-production segment spans that stated date, not merely because it was ever live.
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
  const { asAtDate, deliverableSegments, deliverableStatuses, deliverables, assets, assetCategories, existingDetails = [] } = input;
  if (!asAtDate) throw new Error('An as-at date is required to generate an LKPTI return.');

  const results: LkptiDetail[] = [];
  for (const deliverable of deliverables) {
    if ((deliverable.type ?? 'application') !== 'application') continue;

    // LKPTI is an inventory as at the chosen filing date. ISO YYYY-MM-DD values sort
    // chronologically, so this remains timezone-free and does not depend on the clock
    // of the machine that prepared the return.
    const isLiveAsAt = deliverableSegments.some(seg =>
      seg.deliverableId === deliverable.id
      && isLiveStatusId(seg.status, deliverableStatuses)
      && seg.startDate <= asAtDate
      && seg.endDate >= asAtDate
    );
    if (!isLiveAsAt) continue;

    const category = resolveAssetCategory(deliverable, assets, assetCategories);
    const resolvedCategoryCode = deliverable.categoryCode ?? category?.categoryCode;

    const cascadedFields = {
      categoryCode: resolvedCategoryCode && isLkptiCategoryCode(resolvedCategoryCode) ? resolvedCategoryCode : undefined,
      // The LKPTI column wants whoever built it — 'inhouse', or the provider's name.
      // Both now live on the Deliverable, so a regenerated return reproduces the filed
      // value instead of blanking it for every third-party application (ADR-0013).
      //
      // The literal 'PPJTI' is the exception: it is the RPTI's classification, not a
      // name, and says nothing this column asks for. A workspace predating ADR-0013 may
      // still hold it, so it is treated as "no name given" rather than emitted.
      developer: deliverable.developer === 'PPJTI' ? undefined : deliverable.developer,
      // Attributes of the application. Previously these could only be carried over
      // from an existing row, so generating into an empty set lost all seven.
      platform: deliverable.platform,
      database: deliverable.database,
      dcProvider: deliverable.dcProvider,
      drcProvider: deliverable.drcProvider,
      backupStrategy: deliverable.backupStrategy,
      systemOwner: deliverable.systemOwner,
      ownership: deliverable.ownership,
      dcCity: deliverable.dcCity ?? category?.dcCity,
      dcCountry: deliverable.dcCountry ?? category?.dcCountry,
      drCity: deliverable.drCity ?? category?.drCity,
      drCountry: deliverable.drCountry ?? category?.drCountry,
      functionDescription: deliverable.description,
    };

    // Undefined values are dropped before the spread. The Deliverable is the source of
    // truth for these fields, but a workspace part-way through the ADR-0013 transition
    // can hold a value on the row and not yet on the deliverable — spreading undefined
    // over it would wipe a filed value on regeneration, which is the exact failure this
    // whole change exists to remove. `liftReportRowAttributes` normally makes this moot;
    // this is the belt to its braces.
    const definedCascade = Object.fromEntries(
      Object.entries(cascadedFields).filter(([, v]) => v !== undefined),
    );

    const existing = existingDetails.find(d => d.targetId === deliverable.id);
    if (existing) {
      // Membership is computed from segment spans against `asAtDate`, but the stored
      // row's own `goLiveDate` used to be spread through untouched — so an inventory
      // for 2027 could state a go-live in 2028, answering a different question than
      // the one it claims to answer (F4). Where the filed date post-dates the as-at,
      // fall back to the live segment the membership test itself used. A filed date
      // the as-at supports is more precise than a segment start and is kept (FR-017).
      const storedIso = existing.goLiveDate ? isoFromDdMmYyyy(existing.goLiveDate) : undefined;
      const goLiveDate = storedIso !== undefined && storedIso > asAtDate
        ? suggestGoLiveDate(deliverable.id, deliverableSegments, deliverableStatuses)
        : existing.goLiveDate;
      results.push({ ...existing, ...definedCascade, goLiveDate });
      continue;
    }
    results.push({
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
  reportYear: number,
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
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Report', 'LKPTI Format 3.2.6'],
    ['As-at date', `31 December ${reportYear}`],
  ]), 'Report Metadata');
  XLSX.writeFile(wb, `lkpti-report-${reportYear}.xlsx`);
}
