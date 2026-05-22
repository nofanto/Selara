import { describe, expect, it } from 'vitest';
import { clearApplicationsAndSegments, removeApplicationAndSegments } from './applicationCascade';

const appA = { id: 'app-a', assetId: 'asset-1', name: 'Alpha' };
const appB = { id: 'app-b', assetId: 'asset-2', name: 'Beta' };

const segments = [
  { id: 'seg-1', applicationId: 'app-a', startDate: '2025-01-01', endDate: '2025-03-31', status: 'planned' },
  { id: 'seg-2', applicationId: 'app-a', startDate: '2025-04-01', endDate: '2025-06-30', status: 'active' },
  { id: 'seg-3', applicationId: 'app-b', startDate: '2025-01-01', endDate: '2025-12-31', status: 'retired' },
];

describe('application cascade helpers', () => {
  it('removes an application together with its segments', () => {
    const next = removeApplicationAndSegments(
      { applications: [appA, appB], applicationSegments: segments },
      'app-a',
    );

    expect(next.applications).toEqual([appB]);
    expect(next.applicationSegments).toEqual([segments[2]]);
  });

  it('clears all applications and segments when starting again', () => {
    const next = clearApplicationsAndSegments();

    expect(next).toEqual({ applications: [], applicationSegments: [] });
  });
});
