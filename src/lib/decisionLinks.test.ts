import { describe, expect, it } from 'vitest';
import { decisionsStrandedBy } from './decisionLinks';
import type { Decision } from '../types';

const decision = (id: string, link?: Partial<Decision>): Decision => ({
  id,
  title: id,
  status: 'accepted',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...link,
});

describe('decisionsStrandedBy', () => {
  it('finds a decision pointing at a removed initiative', () => {
    const d = decision('dec-1', { linkedEntityType: 'initiative', linkedEntityId: 'i-1' });

    expect(decisionsStrandedBy([d], [{ type: 'initiative', id: 'i-1' }])).toEqual([d]);
  });

  it('ignores a decision pointing at something that survives', () => {
    const d = decision('dec-1', { linkedEntityType: 'initiative', linkedEntityId: 'i-2' });

    expect(decisionsStrandedBy([d], [{ type: 'initiative', id: 'i-1' }])).toEqual([]);
  });

  it('matches on type as well as id', () => {
    // Ids are prefixed by convention, but the pairing is what makes a link, and
    // relying on prefixes would be a latent bug the day one changes.
    const d = decision('dec-1', { linkedEntityType: 'asset', linkedEntityId: 'x-1' });

    expect(decisionsStrandedBy([d], [{ type: 'initiative', id: 'x-1' }])).toEqual([]);
  });

  it('collects decisions across every removed entity in one cascade', () => {
    const onAsset = decision('dec-asset', { linkedEntityType: 'asset', linkedEntityId: 'a-1' });
    const onInit = decision('dec-init', { linkedEntityType: 'initiative', linkedEntityId: 'i-1' });
    const unrelated = decision('dec-other', { linkedEntityType: 'initiative', linkedEntityId: 'i-9' });

    const found = decisionsStrandedBy(
      [onAsset, onInit, unrelated],
      [{ type: 'asset', id: 'a-1' }, { type: 'initiative', id: 'i-1' }],
    );

    expect(found.map(d => d.id)).toEqual(['dec-asset', 'dec-init']);
  });

  it('ignores decisions that were never linked to anything', () => {
    expect(decisionsStrandedBy([decision('dec-1')], [{ type: 'initiative', id: 'i-1' }])).toEqual([]);
  });

  it('ignores a half-set link (type without id)', () => {
    const d = decision('dec-1', { linkedEntityType: 'initiative' });

    expect(decisionsStrandedBy([d], [{ type: 'initiative', id: 'i-1' }])).toEqual([]);
  });

  it('returns nothing when nothing is being removed', () => {
    const d = decision('dec-1', { linkedEntityType: 'initiative', linkedEntityId: 'i-1' });

    expect(decisionsStrandedBy([d], [])).toEqual([]);
  });
});
