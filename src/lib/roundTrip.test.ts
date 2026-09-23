import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
import { parseLkptiImportWorkbook, deriveWorkspaceFromLkptiImport } from './lkptiImport';
import { parseRptiImportWorkbook, deriveWorkspaceFromRptiImport } from './rptiImport';
import { generateLkptiDetails } from './lkpti';
import { projectRptiReturn, resolveCost } from './rpti';
import { mergeDeliverableStatuses } from './deliverableStatusDefaults';

const load = (n: string) =>
  XLSX.read(readFileSync(new URL(`../../docs/sample-data/${n}`, import.meta.url)), { type: 'buffer' });

/**
 * SC-001 — the feature's reason to exist.
 *
 * Import a filed return, throw away the rows the importer produced, regenerate from
 * the workspace alone, and compare against what the file actually said. Anything the
 * return supplied that the workspace cannot reproduce shows up here.
 *
 * Compares against the *parsed source rows*, not against the importer's own output,
 * so this measures "did the filed value survive" rather than "did we copy our own
 * copy". And CapEx/OpEx are compared through resolveCost, which falls back to the
 * linked initiative — the detail-level fields are overrides, so comparing them raw
 * reports a loss that the exported return does not actually suffer.
 */
// The two sample returns deliberately carry DIFFERENT years — the RPTI is the 2027 plan,
// the LKPTI is the 2026 inventory — which is the case onboarding exists to handle. When
// T022 makes `asAtDate` required, generateLkptiDetails below must be given '2026-12-31',
// not a date derived from REPORT_YEAR. Reaching for the nearby constant asserts the wrong
// period and the test would still pass.
const REPORT_YEAR = 2027;

function importedWorkspace() {
  const lkptiSource = parseLkptiImportWorkbook(load('sample-lkpti-2026.xlsx')).rows;
  const rptiSource = parseRptiImportWorkbook(load('sample-rpti-2027.xlsx')).rows;
  const inv = deriveWorkspaceFromLkptiImport(lkptiSource, 2026);
  const out = deriveWorkspaceFromRptiImport(rptiSource, REPORT_YEAR, {
    deliverables: inv.deliverables, assets: inv.assets, assetCategories: inv.assetCategories,
    deliverableSegments: inv.deliverableSegments, deliverableStatuses: inv.deliverableStatuses,
  });
  return {
    lkptiSource, rptiSource, inv, out,
    workspace: {
      // The RPTI can answer the related-party question for an application the LKPTI
      // created, so its patches to existing deliverables must be merged in. This is
      // the same assembly App.tsx performs after an import.
      deliverables: [
        ...inv.deliverables.map(d => out.updatedDeliverables.find(u => u.id === d.id) ?? d),
        ...out.deliverables,
      ],
      assets: [...inv.assets, ...out.assets],
      assetCategories: [...inv.assetCategories, ...out.assetCategories],
      deliverableSegments: [...inv.deliverableSegments, ...out.deliverableSegments],
      deliverableStatuses: mergeDeliverableStatuses(inv.deliverableStatuses, out.deliverableStatuses),
      initiatives: out.initiatives,
    },
  };
}

describe('SC-001: a generated return reproduces the imported one', () => {
  it('LKPTI: every value the filed return supplied survives regeneration', () => {
    const { lkptiSource, inv, workspace } = importedWorkspace();

    // The proposal under test: store no rows, regenerate from the workspace alone.
    const regenerated = generateLkptiDetails({ ...workspace, asAtDate: '2026-12-31', existingDetails: [] } as never);
    const byName = new Map(
      regenerated.map(r => [workspace.deliverables.find(d => d.id === r.targetId)?.name, r]),
    );

    const lost: string[] = [];
    for (const src of lkptiSource) {
      const got = byName.get(src.name) as unknown as Record<string, unknown> | undefined;
      if (!got) { lost.push(`${src.name}: no row generated at all`); continue; }
      const check = (field: string, expected: unknown) => {
        if (expected === undefined || expected === '') return;
        if (got[field] !== expected) lost.push(`${src.name}.${field}: filed ${JSON.stringify(expected)}, regenerated ${JSON.stringify(got[field])}`);
      };
      check('platform', src.platform);
      check('database', src.database);
      check('dcProvider', src.dcProvider);
      check('drcProvider', src.drcProvider);
      check('backupStrategy', src.backupStrategy);
      check('systemOwner', src.systemOwner);
      check('ownership', src.ownership);
      check('dcCity', src.dcCity);
      check('dcCountry', src.dcCountry);
      check('drCity', src.drCity);
      check('drCountry', src.drCountry);
      check('functionDescription', src.description);
      check('developer', src.developerRaw);
    }
    // Guard against a vacuous developer assertion: the sample must keep carrying both
    // shapes the field takes, or a regression in either could pass unnoticed.
    expect(
      lkptiSource.some(r => r.developerRaw !== '' && r.developerRaw !== 'inhouse'),
      'guard: the sample must contain at least one named vendor',
    ).toBe(true);
    expect(
      lkptiSource.some(r => r.developerRaw === 'inhouse'),
      'guard: the sample must contain at least one in-house application',
    ).toBe(true);
    expect(inv.lkptiDetails.length, 'guard: the import produced rows to compare against').toBe(13);
    expect(lost, `${lost.length} filed value(s) did not survive regeneration`).toEqual([]);
  });

  it('RPTI: every value the filed return supplied survives regeneration', () => {
    const { rptiSource, out, workspace } = importedWorkspace();

    const regenerated = projectRptiReturn(workspace as never, REPORT_YEAR);
    const unresolved = new Set(out.unresolved.map(u => u.name));
    const byName = new Map(
      regenerated.map(r => [workspace.deliverables.find(d => d.id === r.targetId)?.name, r]),
    );

    const lost: string[] = [];
    for (const src of rptiSource) {
      // A row the workspace cannot reproduce is the preparer's to repair (FR-024/025),
      // not a round-trip failure — it is asserted separately below.
      if (unresolved.has(src.name)) continue;
      const got = byName.get(src.name);
      if (!got) { lost.push(`${src.name}: no row generated at all`); continue; }
      const check = (field: string, expected: unknown, actual: unknown) => {
        if (expected === undefined || expected === '') return;
        if (actual !== expected) lost.push(`${src.name}.${field}: filed ${JSON.stringify(expected)}, regenerated ${JSON.stringify(actual)}`);
      };
      check('developmentType', src.developmentType, got.developmentType);
      check('categoryCode', src.categoryCode, got.categoryCode);
      check('developer', src.developer, got.developer);
      check('ppjtiRelatedParty', src.ppjtiRelatedParty, got.ppjtiRelatedParty);
      check('plannedImplementationQuarter', src.plannedQuarter, got.plannedImplementationQuarter);
      check('remarks', src.remarks, (got as unknown as Record<string, unknown>).remarks);
      // The generated row resolves its filed figures from its implementation.
      const cost = resolveCost(got, out.deliverableSegments);
      check('capexAmount', src.capexAmount, cost.capexAmount);
      check('opexAmount', src.opexAmount, cost.opexAmount);
    }
    expect(out.rptiDetails.length, 'guard: the import produced rows to compare against').toBe(13);
    expect(lost, `${lost.length} filed value(s) did not survive regeneration`).toEqual([]);
  });

  it('a row the workspace cannot reproduce is identified, not silently dropped', () => {
    const { out } = importedWorkspace();
    // FR-024: the preparer must be told before a file is produced. Today that is
    // dataHealth's rpti-target finding; this asserts the row is nameable at all.
    expect(out.unresolved.map(u => u.name)).toEqual(['Legacy Teller Application']);
  });
});
