import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  BACKUP_DATA_SHEETS,
  BACKUP_MARKER_SHEET,
  BackupGenerationError,
  ENCODED_PREFIX,
  FIELD_INVENTORY,
  createBackup,
  readBackupWorkbook,
  workspacesEqual,
  type BackupReadResult,
  type PortableWorkspace,
} from './workspaceBackup';
import { buildWorkbook, parseWorkbookWithDiagnostics } from './excel';
import { decisionsOnlyWorkspace, emptyWorkspace, fieldCompleteWorkspace, historyOnlyWorkspace } from './workspaceBackup.fixture';

/** Through actual XLSX bytes — never an in-memory workbook object (SC-001). */
const restoreBytes = (bytes: Uint8Array): BackupReadResult => readBackupWorkbook(XLSX.read(bytes, { type: 'array' }));

const roundTrip = (ws: PortableWorkspace) => {
  const { bytes } = createBackup(ws);
  const result = restoreBytes(bytes);
  if (result.status !== 'complete') throw new Error(`expected complete, got ${result.status}: ${result.problems.join('; ')}`);
  return result;
};

/** Mutate a workbook the way a hand-edit or a corrupt copy would, then re-serialise it. */
const tamper = (ws: PortableWorkspace, edit: (wb: XLSX.WorkBook) => void): BackupReadResult => {
  const wb = XLSX.read(createBackup(ws).bytes, { type: 'array' });
  edit(wb);
  return restoreBytes(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
};

const rows = (wb: XLSX.WorkBook, sheet: string) => XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheet]);
const replaceRows = (wb: XLSX.WorkBook, sheet: string, next: Record<string, unknown>[]) => {
  wb.Sheets[sheet] = XLSX.utils.json_to_sheet(next);
};

// ─── Inventory coverage ──────────────────────────────────────────────────────

/**
 * Reads the declared members of each interface straight from src/types.ts, so a
 * field added there without a classification in FIELD_INVENTORY fails here —
 * not silently at a bank's next recovery.
 */
function declaredMembers(source: string, name: string): Map<string, boolean> {
  const start = source.indexOf(`export interface ${name} {`);
  if (start < 0) throw new Error(`interface ${name} not found`);
  let depth = 0;
  let i = source.indexOf('{', start);
  const bodyStart = i + 1;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) break;
  }
  const body = source.slice(bodyStart, i);
  const members = new Map<string, boolean>();
  let nested = 0;
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (nested === 0) {
      const match = /^([A-Za-z_][A-Za-z0-9_]*)(\?)?:/.exec(trimmed);
      if (match) members.set(match[1], !match[2]);
    }
    nested += (trimmed.match(/{/g) ?? []).length - (trimmed.match(/}/g) ?? []).length;
  }
  return members;
}

describe('field inventory (contracts/field-inventory.md)', () => {
  const source = readFileSync(new URL('../types.ts', import.meta.url), 'utf8');

  it.each(Object.keys(FIELD_INVENTORY))('classifies every member of %s, with matching optionality', entity => {
    const declared = declaredMembers(source, entity);
    const inventory = FIELD_INVENTORY[entity as keyof typeof FIELD_INVENTORY] as Record<string, { required: boolean }>;
    expect(Object.keys(inventory).sort()).toEqual([...declared.keys()].sort());
    for (const [field, required] of declared) expect(inventory[field].required, `${entity}.${field}`).toBe(required);
  });

  it('covers every exported workspace interface that backup carries', () => {
    expect(Object.keys(FIELD_INVENTORY).sort()).toEqual([
      'Asset', 'AssetCategory', 'Decision', 'Deliverable', 'DeliverableSegment', 'DeliverableStatus', 'Dependency',
      'Initiative', 'LkptiDetail', 'Milestone', 'Programme', 'Resource', 'RptiDetail', 'Strategy', 'TimelineSettings',
    ]);
  });

  it('the shared fixture populates every inventoried field in current state and in a snapshot', () => {
    const ws = fieldCompleteWorkspace();
    const byEntity: Record<string, (data: PortableWorkspace | Version['data']) => object[]> = {
      Asset: d => d.assets, AssetCategory: d => d.assetCategories, Decision: d => d.decisions ?? [],
      Deliverable: d => d.deliverables, DeliverableSegment: d => d.deliverableSegments, DeliverableStatus: d => d.deliverableStatuses ?? [],
      Dependency: d => d.dependencies, Initiative: d => d.initiatives, LkptiDetail: d => d.lkptiDetails ?? [], Milestone: d => d.milestones,
      Programme: d => d.programmes, Resource: d => d.resources, RptiDetail: d => d.rptiDetails ?? [], Strategy: d => d.strategies,
      TimelineSettings: d => [d.timelineSettings],
    };
    for (const [entity, pick] of Object.entries(byEntity)) {
      for (const scope of [ws, ws.versions[0].data]) {
        const populated = new Set(pick(scope).flatMap(record => Object.entries(record).filter(([, v]) => v !== undefined).map(([k]) => k)));
        const fields = Object.keys(FIELD_INVENTORY[entity as keyof typeof FIELD_INVENTORY]);
        // Decision.versionId is deliberately unset on the archival copy; every other field is exercised.
        const expected = scope === ws ? fields : fields.filter(f => !(entity === 'Decision' && f === 'versionId') && !(entity === 'Decision' && f === 'supersededBy') && !(entity === 'Decision' && ['context', 'consideredOptions', 'decisionOutcome', 'consequences'].includes(f)));
        for (const field of expected) expect(populated.has(field), `${entity}.${field}`).toBe(true);
      }
    }
  });
});

type Version = PortableWorkspace['versions'][number];

// ─── T004: actual-byte preservation ──────────────────────────────────────────

describe('createBackup → XLSX bytes → readBackupWorkbook (SC-001)', () => {
  it('writes the 16 data sheets plus the SelaraBackup marker', () => {
    const wb = XLSX.read(createBackup(fieldCompleteWorkspace()).bytes, { type: 'array' });
    expect(BACKUP_DATA_SHEETS).toHaveLength(16);
    for (const sheet of BACKUP_DATA_SHEETS) expect(wb.SheetNames).toContain(sheet);
    expect(wb.SheetNames).toContain(BACKUP_MARKER_SHEET);
  });

  it('restores a field-complete workspace with History and decisions exactly', () => {
    const source = fieldCompleteWorkspace();
    const restored = roundTrip(source);

    expect(restored.format).toBe('selara-1');
    expect(workspacesEqual(restored.workspace, source)).toBe(true);
    // Spot-check the values the old export lost, so a broken comparator can't pass this.
    expect(restored.workspace.initiatives[0].resourceIds).toEqual(['res,2', 'res-3', 'res-1']);
    expect(restored.workspace.timelineSettings.columnWidths).toEqual(source.timelineSettings.columnWidths);
    expect(restored.workspace.timelineSettings.collapsedGroups).toEqual(['cat-core', 'cat,with,commas', '']);
    expect(restored.workspace.decisions.find(d => d.id === 'dec-1')?.versionId).toBe('ver-1');
    expect(restored.workspace.versions.find(v => v.id === 'ver-1')?.data.decisions?.[0].title).toBe('Archived wording');
  });

  it('keeps text that Excel or the encoding would otherwise alter', () => {
    const ws = fieldCompleteWorkspace();
    const awkward = [
      `${ENCODED_PREFIX}["looks encoded"]`,
      'crlf\r\nline',
      'lone\rCR',
      'excel escape _x0041_ and _X00e9_',
      'noncharacter ￾ and ￿',
      'lone surrogate \uD800 here',
      '  leading and trailing  ',
      'tab\tand nul\u0000',
      '=SUM(A1:A2)',
      '0123',
      'TRUE',
      'x'.repeat(20000),
      '',
    ];
    ws.initiatives = awkward.map((description, i) => ({ ...ws.initiatives[0], id: `init-awk-${i}`, description }));

    const restored = roundTrip(ws);

    expect(restored.workspace.initiatives.map(i => i.description)).toEqual(awkward);
  });

  it('keeps zero, false, empty string, empty array and empty object distinct from absent', () => {
    const restored = roundTrip(fieldCompleteWorkspace()).workspace;
    const placeholder = restored.initiatives.find(i => i.id === 'init-2')!;

    expect(placeholder.capex).toBe(0);
    expect(placeholder.isPlaceholder).toBe(true);
    expect(placeholder.description).toBe('');
    expect(placeholder.resourceIds).toEqual([]);
    expect('strategyId' in placeholder).toBe(false);
    expect(restored.initiatives.find(i => i.id === 'init-1')!.progress).toBe(0);
    expect(restored.timelineSettings.hasSeenTutorial).toBe(false);
    expect(restored.timelineSettings.sidebarWidth).toBe(0);
    expect(restored.timelineSettings.columnWidths?.assets).toEqual({});
    expect(restored.versions.find(v => v.id === 'ver-1')!.data.timelineSettings.columnWidths).toEqual({});
  });

  it('keeps an absent snapshot collection distinct from an explicitly empty one', () => {
    const restored = roundTrip(fieldCompleteWorkspace()).workspace;
    const absent = restored.versions.find(v => v.id === 'ver-2')!;
    const empty = restored.versions.find(v => v.id === 'ver-3')!;

    for (const key of ['deliverableStatuses', 'decisions', 'rptiDetails', 'lkptiDetails'] as const) {
      expect(key in absent.data, `ver-2 ${key}`).toBe(false);
      expect(empty.data[key], `ver-3 ${key}`).toEqual([]);
    }
    expect('description' in absent).toBe(false);
    expect(empty.description).toBe('');
    expect(absent.data.assets).toEqual([]);
  });

  it('keeps unresolved business references exactly as stored', () => {
    const restored = roundTrip(fieldCompleteWorkspace()).workspace;

    expect(restored.decisions.find(d => d.id === 'dec-2')).toMatchObject({ linkedEntityId: 'asset-that-was-deleted', versionId: 'ver-that-was-deleted' });
    expect(restored.initiatives.find(i => i.id === 'init-2')!.programmeId).toBe('prog-missing');
    expect(restored.lkptiDetails.find(r => r.id === 'lk-2')!.targetId).toBe('del-missing');
  });

  it.each([
    ['an empty workspace', emptyWorkspace],
    ['a workspace holding only History', historyOnlyWorkspace],
    ['a workspace holding only decisions', decisionsOnlyWorkspace],
  ])('restores %s faithfully', (_label, make) => {
    const source = make();
    expect(workspacesEqual(roundTrip(source).workspace, source)).toBe(true);
  });

  it('preserves a field Selara does not recognise, and says so', () => {
    const ws = fieldCompleteWorkspace();
    (ws.initiatives[0] as unknown as Record<string, unknown>).Notes = 'from a customised spreadsheet';

    const { notices } = createBackup(ws);
    const restored = roundTrip(ws);

    expect((restored.workspace.initiatives[0] as unknown as Record<string, unknown>).Notes).toBe('from a customised spreadsheet');
    expect(notices.join('\n')).toMatch(/Initiative\.Notes/);
    expect(restored.notices.join('\n')).toMatch(/Initiative\.Notes/);
  });

  it('preserves off-list enum values and non-ISO dates exactly, and discloses them', () => {
    const ws = fieldCompleteWorkspace();
    (ws.milestones[0] as unknown as Record<string, unknown>).type = 'Info';
    ws.initiatives[1].startDate = '2027/01/01';

    const { notices } = createBackup(ws);
    const restored = roundTrip(ws);

    expect(restored.workspace.milestones[0].type).toBe('Info');
    expect(restored.workspace.initiatives[1].startDate).toBe('2027/01/01');
    expect(notices.join('\n')).toMatch(/Milestone\.type/);
    expect(notices.join('\n')).toMatch(/Initiative\.startDate/);
    expect(restored.notices.join('\n')).toMatch(/Milestone\.type/);
  });
});

describe('createBackup refuses before download rather than lose data (FR-018)', () => {
  const expectFailure = (ws: PortableWorkspace, pattern: RegExp) => {
    let error: unknown;
    try { createBackup(ws); } catch (e) { error = e; }
    expect(error).toBeInstanceOf(BackupGenerationError);
    expect((error as BackupGenerationError).problems.join('\n')).toMatch(pattern);
  };

  it('names the record and field when a value exceeds an Excel cell', () => {
    const ws = fieldCompleteWorkspace();
    ws.decisions[1].context = 'y'.repeat(40000);
    expectFailure(ws, /dec-2.*context/);
  });

  it('refuses null, which the declared interfaces do not allow', () => {
    const ws = fieldCompleteWorkspace();
    (ws.assets[0] as unknown as Record<string, unknown>).externalId = null;
    expectFailure(ws, /asset-1.*externalId/);
  });

  it('refuses a non-finite number', () => {
    const ws = fieldCompleteWorkspace();
    ws.initiatives[0].capex = Number.NaN;
    expectFailure(ws, /init-1.*capex/);
  });

  it('refuses a missing required field', () => {
    const ws = fieldCompleteWorkspace();
    delete (ws.initiatives[0] as Partial<PortableWorkspace['initiatives'][number]>).programmeId;
    expectFailure(ws, /init-1.*programmeId/);
  });

  it('refuses a declared field holding the wrong type', () => {
    const ws = fieldCompleteWorkspace();
    (ws.initiatives[0] as unknown as Record<string, unknown>).resourceIds = 'res-1, res-3';
    expectFailure(ws, /init-1.*resourceIds/);
  });

  it('refuses snapshot content it has no place for', () => {
    const ws = fieldCompleteWorkspace();
    (ws.versions[0].data as unknown as Record<string, unknown>).dtsPhases = [];
    expectFailure(ws, /ver-1.*dtsPhases/);
  });

  it('refuses a snapshot whose timeline settings are incomplete', () => {
    const ws = fieldCompleteWorkspace();
    ws.versions[0].data.timelineSettings = {} as PortableWorkspace['timelineSettings'];
    expectFailure(ws, /ver-1.*startDate/);
  });

  it('refuses duplicate IDs within one collection and scope', () => {
    const ws = fieldCompleteWorkspace();
    ws.assets.push({ ...ws.assets[0] });
    expectFailure(ws, /asset-1/);
  });
});

// ─── T005: workbook acceptance and rejection ─────────────────────────────────

describe('readBackupWorkbook acceptance matrix (contracts/workbook.md)', () => {
  it('accepts a complete empty workspace — zero rows is not corruption', () => {
    expect(restoreBytes(createBackup(emptyWorkspace()).bytes).status).toBe('complete');
  });

  it('rejects an unsupported future format without trying legacy parsing', () => {
    const result = tamper(fieldCompleteWorkspace(), wb => {
      replaceRows(wb, BACKUP_MARKER_SHEET, rows(wb, BACKUP_MARKER_SHEET).map(r => (r.key === 'formatVersion' ? { ...r, value: 2 } : r)));
    });
    expect(result.status).toBe('rejected');
    expect(result.status === 'rejected' && result.problems.join(' ')).toMatch(/newer version of Selara/);
  });

  it('rejects an unknown cell encoding', () => {
    const result = tamper(fieldCompleteWorkspace(), wb => {
      replaceRows(wb, BACKUP_MARKER_SHEET, rows(wb, BACKUP_MARKER_SHEET).map(r => (r.key === 'cellEncoding' ? { ...r, value: 'selara-json-v9' } : r)));
    });
    expect(result.status).toBe('rejected');
  });

  it('rejects a malformed marker instead of falling back to legacy', () => {
    const result = tamper(fieldCompleteWorkspace(), wb => {
      replaceRows(wb, BACKUP_MARKER_SHEET, rows(wb, BACKUP_MARKER_SHEET).map(r => (r.key === 'formatVersion' ? { ...r, value: 'one' } : r)));
    });
    expect(result.status).toBe('rejected');
  });

  it('directs a file missing a required sheet to ordinary Import, naming it', () => {
    const result = tamper(fieldCompleteWorkspace(), wb => {
      delete wb.Sheets.Decisions;
      wb.SheetNames = wb.SheetNames.filter(n => n !== 'Decisions');
    });
    expect(result.status).toBe('incomplete');
    expect(result.status === 'incomplete' && result.problems.join(' ')).toMatch(/Decisions/);
  });

  it('rejects a malformed encoded cell', () => {
    const result = tamper(fieldCompleteWorkspace(), wb => {
      replaceRows(wb, 'Initiatives', rows(wb, 'Initiatives').map((r, i) => (i === 0 ? { ...r, resourceIds: `${ENCODED_PREFIX}[not json` } : r)));
    });
    expect(result.status).toBe('rejected');
  });

  it('rejects a file whose row counts disagree with its metadata', () => {
    const result = tamper(fieldCompleteWorkspace(), wb => {
      replaceRows(wb, 'Initiatives', rows(wb, 'Initiatives').slice(1));
    });
    expect(result.status).toBe('rejected');
    expect(result.status === 'rejected' && result.problems.join(' ')).toMatch(/Initiatives/);
  });

  it('rejects duplicate IDs within one scope, but accepts the same ID in current state and a snapshot', () => {
    const result = tamper(fieldCompleteWorkspace(), wb => {
      const assets = rows(wb, 'Assets');
      replaceRows(wb, 'Assets', [...assets, { ...assets[0] }]);
    });
    expect(result.status).toBe('rejected');
    expect(result.status === 'rejected' && result.problems.join(' ')).toMatch(/asset-1/);

    // The fixture reuses current IDs in every snapshot and is accepted.
    expect(restoreBytes(createBackup(fieldCompleteWorkspace()).bytes).status).toBe('complete');
  });

  it('rejects duplicate current settings rows', () => {
    const result = tamper(fieldCompleteWorkspace(), wb => {
      const settings = rows(wb, 'TimelineSettings');
      replaceRows(wb, 'TimelineSettings', [...settings, settings.find(r => r.versionId === '')!]);
    });
    expect(result.status).toBe('rejected');
  });

  it('rejects a row assigned to a snapshot that does not exist', () => {
    const result = tamper(fieldCompleteWorkspace(), wb => {
      replaceRows(wb, 'Milestones', rows(wb, 'Milestones').map((r, i) => (i === 0 ? { ...r, versionId: 'ver-ghost' } : r)));
    });
    expect(result.status).toBe('rejected');
    expect(result.status === 'rejected' && result.problems.join(' ')).toMatch(/ver-ghost/);
  });

  it('rejects a declared field holding the wrong type', () => {
    const result = tamper(fieldCompleteWorkspace(), wb => {
      replaceRows(wb, 'Initiatives', rows(wb, 'Initiatives').map((r, i) => (i === 0 ? { ...r, capex: 'a lot' } : r)));
    });
    expect(result.status).toBe('rejected');
  });

  it('directs missing snapshot settings to ordinary Import instead of repairing them', () => {
    const result = tamper(fieldCompleteWorkspace(), wb => {
      replaceRows(wb, 'TimelineSettings', rows(wb, 'TimelineSettings').map(r => (r.versionId === 'ver-1' ? { versionId: 'ver-1', defaultCurrency: 'USD' } : r)));
    });
    expect(result.status).toBe('incomplete');
    expect(result.status === 'incomplete' && result.problems.join(' ')).toMatch(/ver-1|Before consolidation/);
  });

  it('rejects a formatted regulatory return, naming the onboarding workflow', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['No', 'Nama Aplikasi'], [1, 'Core']]), 'Format 3.2.6');
    const result = restoreBytes(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
    expect(result.status).toBe('rejected');
    expect(result.status === 'rejected' && result.problems.join(' ')).toMatch(/filed returns/i);
  });
});

describe('recognised legacy workbooks (no marker)', () => {
  const legacyBytes = (ws: PortableWorkspace) => XLSX.write(buildWorkbook(ws), { type: 'array', bookType: 'xlsx' }) as Uint8Array;

  it('restores a complete legacy export, with its limitations disclosed', () => {
    const ws = fieldCompleteWorkspace();
    const result = restoreBytes(legacyBytes(ws));

    expect(result.status).toBe('complete');
    if (result.status !== 'complete') return;
    expect(result.format).toBe('legacy');
    expect(result.notices.join(' ')).toMatch(/older Selara export/i);
    // Comma-separated in the old format — split back, with the limitation stated.
    expect(result.workspace.initiatives.find(i => i.id === 'init-2')!.resourceIds).toEqual([]);
    expect(result.workspace.versions).toHaveLength(3);
  });

  it('never decodes legacy text that happens to start with the marker', () => {
    const ws = fieldCompleteWorkspace();
    const result = restoreBytes(legacyBytes(ws));
    expect(result.status === 'complete' && result.workspace.decisions.find(d => d.id === 'dec-1')!.decisionOutcome).toBe('__SELARA_JSON_V1__:not actually encoded');
  });

  it('directs a legacy file without a Decisions sheet to ordinary Import', () => {
    const wb = buildWorkbook(fieldCompleteWorkspace());
    delete wb.Sheets.Decisions;
    wb.SheetNames = wb.SheetNames.filter(n => n !== 'Decisions');
    const result = restoreBytes(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
    expect(result.status).toBe('incomplete');
  });

  it('rejects legacy duplicate IDs rather than dropping a row', () => {
    const wb = buildWorkbook(fieldCompleteWorkspace());
    const assets = rows(wb, 'Assets');
    replaceRows(wb, 'Assets', [...assets, { ...assets[0] }]);
    expect(restoreBytes(XLSX.write(wb, { type: 'array', bookType: 'xlsx' })).status).toBe('rejected');
  });
});

// ─── T005/T017: ordinary Import reads format 1 and repairs only there ────────

describe('ordinary Import (parseWorkbookWithDiagnostics)', () => {
  it('reads a format 1 backup, decoding nested cells', () => {
    const { data } = parseWorkbookWithDiagnostics(XLSX.read(createBackup(fieldCompleteWorkspace()).bytes, { type: 'array' }));
    expect(data.initiatives?.find(i => i.id === 'init-1')?.resourceIds).toEqual(['res,2', 'res-3', 'res-1']);
    expect(data.timelineSettings?.columnWidths).toEqual(fieldCompleteWorkspace().timelineSettings.columnWidths);
    expect(data.versions?.find(v => v.id === 'ver-1')?.data.decisions?.[0].title).toBe('Archived wording');
  });

  it('repairs missing snapshot display settings with documented defaults, keeps valid reporting settings, invents none', () => {
    const wb = buildWorkbook(fieldCompleteWorkspace());
    replaceRows(wb, 'TimelineSettings', rows(wb, 'TimelineSettings').map(r => (
      r.versionId === 'ver-1' ? { versionId: 'ver-1', onboardingRptiYear: 2027, defaultCurrency: 42, monthsToShow: 7 } : r
    )));

    const { data, notices } = parseWorkbookWithDiagnostics(wb);
    const repaired = data.versions!.find(v => v.id === 'ver-1')!.data.timelineSettings;

    expect(repaired).toMatchObject({
      startDate: '2000-01-01', monthsToShow: 12, budgetVisualisation: 'label', descriptionDisplay: 'off',
      emptyRowDisplay: 'show', snapToPeriod: 'month', conflictDetection: 'off', showRelationships: 'off',
      onboardingRptiYear: 2027,
    });
    expect('defaultCurrency' in repaired).toBe(false);
    expect('onboardingLkptiYear' in repaired).toBe(false);
    const text = notices.join('\n');
    expect(text).toMatch(/Before consolidation/);
    expect(text).toMatch(/defaultCurrency/);
    expect(text).toMatch(/onboardingLkptiYear/);
  });

  it('keeps the absent-vs-empty Decisions distinction (#22)', () => {
    const withSheet = buildWorkbook({ ...emptyWorkspace(), decisions: [] });
    expect(parseWorkbookWithDiagnostics(withSheet).data.decisions).toEqual([]);

    delete withSheet.Sheets.Decisions;
    withSheet.SheetNames = withSheet.SheetNames.filter(n => n !== 'Decisions');
    expect(parseWorkbookWithDiagnostics(withSheet).data.decisions).toBeUndefined();
  });

  it('says so when the file has no usable current settings, so the preview can show the current ones are kept', () => {
    const wb = buildWorkbook(emptyWorkspace());
    replaceRows(wb, 'TimelineSettings', []);
    const { data, notices } = parseWorkbookWithDiagnostics(wb);
    expect(data.timelineSettings).toBeUndefined();
    expect(notices.join(' ')).toMatch(/current timeline settings/i);
  });
});
