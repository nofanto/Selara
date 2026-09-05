import { describe, expect, it } from 'vitest';
import { validateImportSchema } from './importValidation';

describe('validateImportSchema', () => {
  it('treats missing initiative programmeId and assetId as blocking errors', () => {
    const issues = validateImportSchema({
      initiatives: [
        {
          id: 'init-1',
          name: 'Broken initiative',
          startDate: '2025-01-01',
          endDate: '2025-12-31',
          capex: 1000,
          opex: 500,
        },
      ],
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entity: 'initiatives', issue: '"programmeId" missing in 1 record', severity: 'error' }),
        expect.objectContaining({ entity: 'initiatives', issue: '"assetId" missing in 1 record', severity: 'error' }),
      ]),
    );
  });

  it('keeps missing initiative startDate as a non-blocking warning', () => {
    const issues = validateImportSchema({
      initiatives: [
        {
          id: 'init-2',
          name: 'Legacy initiative',
          programmeId: 'prog-1',
          assetId: 'asset-1',
          endDate: '2025-12-31',
          capex: 1000,
          opex: 500,
        },
      ],
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entity: 'initiatives', issue: '"startDate" missing in 1 record', severity: 'warning' }),
      ]),
    );
  });
});

describe('validateImportSchema — decisions (#22)', () => {
  it('reports a decision missing its title as an error', () => {
    const issues = validateImportSchema({
      decisions: [{ id: 'dec-1', status: 'accepted', createdAt: '2026-05-01T00:00:00.000Z' }],
    });

    const titleIssue = issues.find(i => i.entity === 'decisions' && i.issue.includes('title'));
    // `title` is a decision's only mandatory field — the same rule DecisionsView
    // enforces on save — so a file missing it is broken, not merely suspect.
    expect(titleIssue?.severity).toBe('error');
  });

  it('reports a decision missing its id as an error', () => {
    const issues = validateImportSchema({
      decisions: [{ title: 'Consolidate identity', status: 'accepted', createdAt: '2026-05-01T00:00:00.000Z' }],
    });

    expect(issues.find(i => i.entity === 'decisions' && i.issue.includes('id'))?.severity).toBe('error');
  });

  it('treats missing optional MADR fields as no issue at all', () => {
    // ADR-0002 deliberately made everything past the title optional so small,
    // routine decisions stay cheap to record. Flagging their absence on import
    // would contradict that.
    const issues = validateImportSchema({
      decisions: [{ id: 'dec-1', title: 'Consolidate identity', status: 'accepted', createdAt: '2026-05-01T00:00:00.000Z' }],
    });

    expect(issues.filter(i => i.entity === 'decisions')).toEqual([]);
  });
});
