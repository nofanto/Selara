import { describe, expect, it } from 'vitest';
import { buildHistoryStream, decisionsForSpan } from './historyStream';
import type { Decision, Version } from '../types';

const version = (id: string, timestamp: string, name = id): Version => ({
  id,
  name,
  timestamp,
  data: {
    assets: [], deliverables: [], deliverableSegments: [], initiatives: [], milestones: [],
    programmes: [], strategies: [], dependencies: [], assetCategories: [], resources: [],
    timelineSettings: {} as Version['data']['timelineSettings'],
  },
});

const decision = (id: string, createdAt: string, extra: Partial<Decision> = {}): Decision => ({
  id,
  title: id,
  status: 'accepted',
  createdAt,
  ...extra,
});

describe('decisionsForSpan', () => {
  const march = version('ver-march', '2026-03-01T00:00:00.000Z');
  const june = version('ver-june', '2026-06-01T00:00:00.000Z');

  it('includes decisions recorded between the two snapshots', () => {
    const inside = decision('dec-april', '2026-04-15T00:00:00.000Z');
    const before = decision('dec-jan', '2026-01-15T00:00:00.000Z');
    const after = decision('dec-july', '2026-07-15T00:00:00.000Z');

    const found = decisionsForSpan([before, inside, after], march, june);

    expect(found.map(d => d.id)).toEqual(['dec-april']);
  });

  it('includes a decision linked to either endpoint even when written long after', () => {
    // The window alone would miss this: someone documenting the June change in
    // September, having linked it explicitly.
    const late = decision('dec-sept', '2026-09-20T00:00:00.000Z', { versionId: 'ver-june' });

    expect(decisionsForSpan([late], march, june).map(d => d.id)).toEqual(['dec-sept']);
  });

  it('does not double-count a decision matched by both rules', () => {
    const both = decision('dec-april', '2026-04-15T00:00:00.000Z', { versionId: 'ver-june' });

    expect(decisionsForSpan([both], march, june)).toHaveLength(1);
  });

  it('ignores a decision linked to some unrelated version', () => {
    const other = decision('dec-other', '2026-09-20T00:00:00.000Z', { versionId: 'ver-december' });

    expect(decisionsForSpan([other], march, june)).toEqual([]);
  });

  it('gives the same answer whichever order the two versions are passed in', () => {
    const inside = decision('dec-april', '2026-04-15T00:00:00.000Z');

    expect(decisionsForSpan([inside], june, march)).toEqual(decisionsForSpan([inside], march, june));
  });

  it('returns newest first', () => {
    const may = decision('dec-may', '2026-05-01T00:00:00.000Z');
    const april = decision('dec-april', '2026-04-01T00:00:00.000Z');

    expect(decisionsForSpan([april, may], march, june).map(d => d.id)).toEqual(['dec-may', 'dec-april']);
  });

  it('counts decisions recorded exactly on either boundary', () => {
    const onStart = decision('dec-start', '2026-03-01T00:00:00.000Z');
    const onEnd = decision('dec-end', '2026-06-01T00:00:00.000Z');

    expect(decisionsForSpan([onStart, onEnd], march, june)).toHaveLength(2);
  });
});

describe('buildHistoryStream', () => {
  it('interleaves versions and decisions newest first', () => {
    const entries = buildHistoryStream(
      [version('ver-1', '2026-03-01T00:00:00.000Z'), version('ver-2', '2026-05-01T00:00:00.000Z')],
      [decision('dec-1', '2026-04-01T00:00:00.000Z')],
    );

    expect(entries.map(e => [e.kind, e.id])).toEqual([
      ['version', 'ver-2'],
      ['decision', 'dec-1'],
      ['version', 'ver-1'],
    ]);
  });

  it('attaches a linked decision to its version instead of listing it separately', () => {
    const entries = buildHistoryStream(
      [version('ver-1', '2026-03-01T00:00:00.000Z')],
      [decision('dec-1', '2026-03-01T00:00:05.000Z', { versionId: 'ver-1' })],
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe('version');
    expect(entries[0].kind === 'version' && entries[0].decisions.map(d => d.id)).toEqual(['dec-1']);
  });

  it('lists a decision separately when its versionId does not resolve', () => {
    // A version can be deleted while decisions referencing it survive — the
    // decision must not vanish from the stream with it.
    const entries = buildHistoryStream([], [decision('dec-1', '2026-04-01T00:00:00.000Z', { versionId: 'ver-gone' })]);

    expect(entries.map(e => e.kind)).toEqual(['decision']);
  });

  it('reports an empty stream for an empty workspace', () => {
    expect(buildHistoryStream([], [])).toEqual([]);
  });
});
