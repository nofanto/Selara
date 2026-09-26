import { describe, it, expect } from 'vitest';
import { projectRptiReturn, reconcileRptiReturn } from './rpti';
import { generateLkptiDetails } from './lkpti';
import { SEEDED_DELIVERABLE_STATUSES } from './deliverableStatusDefaults';
import { rankRepairCandidates } from './unresolvedRowRepair';

/**
 * Quickstart level 12, and [#36](https://github.com/nofanto/Selara/issues/36)'s standing
 * requirement that this works for a real bank's portfolio rather than the demo's 17
 * applications. Both generators walk every deliverable and every segment, and
 * `reconcileRptiReturn` walks every stored row against the source model, so all three
 * are linear-with-a-lookup rather than quadratic — a claim worth holding a test against,
 * because the way to break it is an innocent-looking `.find()` inside a loop.
 *
 * The bound is deliberately loose. This guards against an accidental O(n^2), not against
 * a few milliseconds of drift on a busy machine.
 */
describe('generating returns at portfolio scale (#36, quickstart level 12)', () => {
  it('produces both returns and reconciles several implementations for 300 applications well inside a click', () => {
    const N = 300;
    const IMPLEMENTATIONS_PER_APPLICATION = 3;
    const statuses = SEEDED_DELIVERABLE_STATUSES;
    const live = statuses.find(s => s.isLiveStatus)!.id;
    const assetCategories = [{ id: 'c1', name: 'Cat', categoryCode: '06' as const }];
    const assets = Array.from({ length: N }, (_, i) => ({ id: `a${i}`, name: `Asset ${i}`, categoryId: 'c1' }));
    const deliverables = Array.from({ length: N }, (_, i) => ({
      id: `d${i}`, assetId: `a${i}`, name: `App ${i}`, type: 'application' as const,
      platform: 'Linux', database: 'PostgreSQL', systemOwner: 'IT', developer: 'inhouse',
    }));
    const initiatives = Array.from({ length: N }, (_, i) => ({
      id: `i${i}`, name: `Init ${i}`, programmeId: 'p1', assetId: `a${i}`,
      startDate: '2027-01-01', endDate: '2027-12-31', capex: 1, opex: 1,
    }));
    const implementationDates = ['2027-02-01', '2027-06-01', '2027-10-01'];
    const deliverableSegments = Array.from({ length: N }, (_, i) =>
      implementationDates.map((startDate, implementationIndex) => ({
        id: `s${i}-${implementationIndex}`, deliverableId: `d${i}`, initiativeId: `i${i}`, status: live,
        startDate, endDate: '2031-12-31',
      }))).flat();
    const ws = { assets, assetCategories, deliverables, initiatives, deliverableSegments, deliverableStatuses: statuses };

    const t0 = performance.now();
    const rpti = projectRptiReturn(ws as never, 2027);
    const lkpti = generateLkptiDetails({ ...ws, asAtDate: '2027-12-31', existingDetails: [] } as never);
    const findings = reconcileRptiReturn({ ...ws, storedDetails: rpti } as never);
    const ms = performance.now() - t0;

    expect(rpti).toHaveLength(N * IMPLEMENTATIONS_PER_APPLICATION);
    expect(lkpti).toHaveLength(N);
    expect(findings, 'a healthy workspace must produce no reconciliation noise').toEqual([]);
    expect(ms, `both returns + reconciliation took ${ms.toFixed(0)}ms for ${N} applications`).toBeLessThan(2000);

    const rankStart = performance.now();
    const ranked = rankRepairCandidates({ id: 'unresolved', initiativeId: 'i0', targetType: 'deliverable',
      targetId: 'rpti-import-unresolved-0', developmentType: 'upgrade', categoryCode: '06' },
      'App 0', ws);
    const rankMs = performance.now() - rankStart;
    expect(ranked).toHaveLength(N);
    expect(ranked[0]).toMatchObject({ tier: 'same-name', deliverable: { id: 'd0' } });
    expect(rankMs, `ranking ${N} applications took ${rankMs.toFixed(0)}ms`).toBeLessThan(2000);
  });
});
