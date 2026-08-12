import { describe, expect, it } from 'vitest';
import { isWorkspaceEmpty } from './workspaceState';

describe('isWorkspaceEmpty', () => {
  it('treats a brand new workspace as empty', () => {
    expect(
      isWorkspaceEmpty({
        assets: [],
        deliverables: [],
        deliverableSegments: [],
        initiatives: [],
        milestones: [],
        programmes: [],
        strategies: [],
        dependencies: [],
        assetCategories: [],
        resources: [],
        deliverableStatuses: [],
      }),
    ).toBe(true);
  });

  it('treats any persisted user data as non-empty', () => {
    expect(
      isWorkspaceEmpty({
        assets: [],
        deliverables: [],
        deliverableSegments: [],
        initiatives: [],
        milestones: [{ id: 'm1' }],
        programmes: [],
        strategies: [],
        dependencies: [],
        assetCategories: [],
        resources: [],
        deliverableStatuses: [],
      }),
    ).toBe(false);
  });

  it('does not rely only on assets and initiatives when other tables contain data', () => {
    expect(
      isWorkspaceEmpty({
        assets: [],
        deliverables: [{ id: 'app-1' }],
        deliverableSegments: [],
        initiatives: [],
        milestones: [],
        programmes: [],
        strategies: [],
        dependencies: [],
        assetCategories: [],
        resources: [],
        deliverableStatuses: [],
      }),
    ).toBe(false);
  });
});
