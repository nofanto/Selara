import { describe, expect, it } from 'vitest';
import { clearDeliverablesAndSegments, removeDeliverableAndSegments } from './deliverableCascade';

const appA = { id: 'app-a', assetId: 'asset-1', name: 'Alpha' };
const appB = { id: 'app-b', assetId: 'asset-2', name: 'Beta' };

const segments = [
  { id: 'seg-1', deliverableId: 'app-a', startDate: '2025-01-01', endDate: '2025-03-31', status: 'planned' },
  { id: 'seg-2', deliverableId: 'app-a', startDate: '2025-04-01', endDate: '2025-06-30', status: 'active' },
  { id: 'seg-3', deliverableId: 'app-b', startDate: '2025-01-01', endDate: '2025-12-31', status: 'retired' },
];

describe('deliverable cascade helpers', () => {
  it('removes a deliverable together with its segments', () => {
    const next = removeDeliverableAndSegments(
      { deliverables: [appA, appB], deliverableSegments: segments },
      'app-a',
    );

    expect(next.deliverables).toEqual([appB]);
    expect(next.deliverableSegments).toEqual([segments[2]]);
  });

  it('clears all deliverables and segments when starting again', () => {
    const next = clearDeliverablesAndSegments();

    expect(next).toEqual({ deliverables: [], deliverableSegments: [] });
  });
});
