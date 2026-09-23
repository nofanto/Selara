import { describe, expect, it } from 'vitest';
import { validateDeliverableSegment } from './validation';

describe('validateDeliverableSegment', () => {
  it('rejects negative implementation filing costs without changing initiative validation (T028)', () => {
    const segment = {
      id: 'seg-1', deliverableId: 'deliv-1', status: 'appstatus-in-production',
      startDate: '2027-01-01', endDate: '2031-12-31', capexAmount: -1, opexAmount: -2,
    };

    expect(validateDeliverableSegment(segment)).toMatchObject({
      capexAmount: 'Filed CapEx cannot be negative',
      opexAmount: 'Filed OpEx cannot be negative',
    });
  });
});
