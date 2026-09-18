import { describe, it, expect } from 'vitest';
import { projectRptiReturn, reconcileRptiReturn } from './rpti';
import { generateLkptiDetails } from './lkpti';
import { SEEDED_DELIVERABLE_STATUSES } from './deliverableStatusDefaults';

/**
 * Quickstart level 7, and [#36](https://github.com/nofanto/Selara/issues/36)'s standing
 * requirement that this works for a real bank's portfolio rather than the demo's 17
 * applications. Both generators walk every deliverable and every segment, and
 * `reconcileRptiReturn` walks every stored row against the source model, so all three
 * are linear-with-a-lookup rather than quadratic — a claim worth holding a test against,
 * because the way to break it is an innocent-looking `.find()` inside a loop.
 *
 * The bound is deliberately loose. This guards against an accidental O(n^2), not against
 * a few milliseconds of drift on a busy machine.
 */
describe('generating returns at portfolio scale (#36, quickstart level 7)', () => {
  it('produces both returns and reconciles them for 300 applications well inside a click', () => {
    const N = 300;
    const statuses = SEEDED_DELIVERABLE_STATUSES;
    const live = statuses.find(s => s.isLiveStatus)!.id;
    const assetCategories = [{ id: 'c1', name: 'Cat', categoryCode: '06' as const }];
    const assets = Array.from({ length: N }, (_, i) => ({ id: `a${i}`, name: `Asset ${i}`, categoryId: 'c1' }));
    const deliverables = Array.from({ length: N }, (_, i) => ({
      id: `d${i}`, assetId: `a${i}`, name: `App ${i}`, type: 'application' as const,
      platform: 'Linux', database: 'PostgreSQL', systemOwner: 'IT', developer: 'inhouse',
    }));
    const initiatives = Array.from({ length: N }, (_, i) => ({
      id: `i${i}`, name: `Init ${i}`, programmeId: 'p1', assetId: `a${i}`, deliverableId: `d${i}`,
      startDate: '2027-01-01', endDate: '2027-12-31', capex: 1, opex: 1,
    }));
    const deliverableSegments = Array.from({ length: N }, (_, i) => ({
      id: `s${i}`, deliverableId: `d${i}`, initiativeId: `i${i}`, status: live,
      startDate: '2027-02-01', endDate: '2031-12-31',
    }));
    const ws = { assets, assetCategories, deliverables, initiatives, deliverableSegments, deliverableStatuses: statuses };

    const t0 = performance.now();
    const rpti = projectRptiReturn(ws as never, 2027);
    const lkpti = generateLkptiDetails({ ...ws, asAtDate: '2027-12-31', existingDetails: [] } as never);
    const findings = reconcileRptiReturn({ ...ws, storedDetails: rpti } as never);
    const ms = performance.now() - t0;

    expect(rpti).toHaveLength(N);
    expect(lkpti).toHaveLength(N);
    expect(findings, 'a healthy workspace must produce no reconciliation noise').toEqual([]);
    expect(ms, `both returns + reconciliation took ${ms.toFixed(0)}ms for ${N} applications`).toBeLessThan(2000);
  });
});
