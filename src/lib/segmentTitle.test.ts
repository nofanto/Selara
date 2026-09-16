import { describe, expect, it } from 'vitest';
import { buildWorkbook, parseWorkbook } from './excel';
import { computeDiff } from './diff';
import type { DeliverableSegment, Version } from '../types';

// AppData is declared inside excel.ts and not exported from types.ts, so the shape
// is taken from the function that consumes it rather than re-declared here.
type WorkspaceData = Parameters<typeof buildWorkbook>[0];

/**
 * ADR-0012 rests on one claim: that adding a field to DeliverableSegment needs no
 * change to excel.ts or diff.ts, because both are generic — buildWorkbook flattens
 * whatever fields a record carries, and compareEntities diffs them. That is the
 * reason the decision was cheap, so it is asserted rather than assumed.
 */
const seg = (over: Partial<DeliverableSegment> = {}): DeliverableSegment => ({
  id: 'seg-1', deliverableId: 'd-1', startDate: '2027-01-01', endDate: '2027-03-31',
  status: 'appstatus-planned', ...over,
});

const emptyData = (segments: DeliverableSegment[]): WorkspaceData => ({
  assets: [], deliverables: [], deliverableSegments: segments, initiatives: [], milestones: [],
  programmes: [], strategies: [], dependencies: [], assetCategories: [], resources: [],
  deliverableStatuses: [], decisions: [], rptiDetails: [], lkptiDetails: [], versions: [],
  timelineSettings: {
    startDate: '2027-01-01', monthsToShow: 12, budgetVisualisation: 'off',
    descriptionDisplay: 'off', emptyRowDisplay: 'show', snapToPeriod: 'off',
    conflictDetection: 'on', showRelationships: 'on', criticalPath: 'off', showResources: 'off',
  },
} as unknown as WorkspaceData);

describe('DeliverableSegment.title (ADR-0012)', () => {
  it('survives the workspace round trip with no change to excel.ts', () => {
    const back = parseWorkbook(buildWorkbook(emptyData([seg({ title: 'Phase 1 rollout' })])));
    expect(back.deliverableSegments?.[0].title).toBe('Phase 1 rollout');
  });

  it('leaves a segment without a title untitled rather than inventing one', () => {
    const back = parseWorkbook(buildWorkbook(emptyData([seg()])));
    expect(back.deliverableSegments?.[0].title ?? '').toBe('');
  });

  it('is reported by the version diff with no change to diff.ts', () => {
    const base = { id: 'v1', name: 'Baseline', timestamp: '2027-01-01T00:00:00.000Z',
      data: emptyData([seg({ title: 'Phase 1' })]) } as unknown as Version;
    const diff = computeDiff(base, emptyData([seg({ title: 'Phase 2' })]) as never);
    const changes = diff.deliverableSegments.modified.flatMap(m => m.changes);
    expect(changes.some(c => c.includes('Phase 1') && c.includes('Phase 2'))).toBe(true);
  });
});
