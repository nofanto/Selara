import { describe, expect, it } from 'vitest';
import type { RptiDetail, RptiCategoryCode } from '../types';
import { isRepairableUnresolvedRow, repairOptions } from './unresolvedRowRepair';

const row = (targetId: string, categoryCode: RptiCategoryCode = '12', deliverableSegmentId?: string): RptiDetail => ({
  id: 'row-1', initiativeId: 'initiative-1', targetType: 'deliverable', targetId,
  categoryCode, developmentType: 'upgrade', plannedImplementationQuarter: 'Q3', deliverableSegmentId,
});

describe('unresolved row repair eligibility', () => {
  it('accepts only unanchored import placeholders', () => {
    expect(isRepairableUnresolvedRow(row('rpti-import-unresolved-1'))).toBe(true);
    expect(isRepairableUnresolvedRow(row('deleted-deliverable'))).toBe(false);
    expect(isRepairableUnresolvedRow(row('rpti-import-unresolved-1', '12', 'segment-1'))).toBe(false);
  });

  it('offers creation only for application categories', () => {
    expect(repairOptions(row('rpti-import-unresolved-1', '12'))).toEqual(['existing', 'create']);
    for (const code of ['51', '52', '53', '54', '99'] as RptiCategoryCode[]) {
      expect(repairOptions(row('rpti-import-unresolved-1', code))).toEqual(['existing']);
    }
  });
});
