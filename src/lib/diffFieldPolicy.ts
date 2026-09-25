import type {
  Asset, AssetCategory, Deliverable, DeliverableSegment, DeliverableStatus,
  Dependency, Initiative, LkptiDetail, Milestone, Programme, Resource,
  RptiDetail, Strategy,
} from '../types';
import type { DiffSectionKey } from './diff';

/** An exhaustive classification of every field on every entity compared by computeDiff. */
export type FieldPolicy = 'diffed' | { excluded: string };
const identity = { excluded: 'Immutable identity; a different ID is a removal and addition.' } as const;
const layout = { excluded: 'Pure timeline layout; dragging must not fill history.' } as const;

export const diffFieldPolicy = {
  assets: {
    id: identity, name: 'diffed', categoryId: 'diffed', maturity: 'diffed', externalId: 'diffed',
  } satisfies Record<keyof Asset, FieldPolicy>,
  programmes: {
    id: identity, name: 'diffed', color: 'diffed',
  } satisfies Record<keyof Programme, FieldPolicy>,
  strategies: {
    id: identity, name: 'diffed', color: 'diffed',
  } satisfies Record<keyof Strategy, FieldPolicy>,
  initiatives: {
    id: identity, name: 'diffed', programmeId: 'diffed', strategyId: 'diffed',
    assetId: 'diffed', startDate: 'diffed', endDate: 'diffed', capex: 'diffed',
    opex: 'diffed', description: 'diffed', isPlaceholder: 'diffed', status: 'diffed',
    ragStatus: 'diffed', progress: 'diffed', owner: 'diffed', ownerId: 'diffed',
    resourceIds: 'diffed',
  } satisfies Record<keyof Initiative, FieldPolicy>,
  dependencies: {
    id: identity, sourceId: 'diffed', targetId: 'diffed', type: 'diffed',
    midXOffset: layout, sourceType: 'diffed', targetType: 'diffed',
  } satisfies Record<keyof Dependency, FieldPolicy>,
  milestones: {
    id: identity, assetId: 'diffed', date: 'diffed', name: 'diffed', type: 'diffed',
  } satisfies Record<keyof Milestone, FieldPolicy>,
  deliverables: {
    id: identity, assetId: 'diffed', name: 'diffed', type: 'diffed',
    description: 'diffed', categoryCode: 'diffed', developer: 'diffed',
    dcCity: 'diffed', dcCountry: 'diffed', drCity: 'diffed', drCountry: 'diffed',
    platform: 'diffed', database: 'diffed', dcProvider: 'diffed',
    drcProvider: 'diffed', backupStrategy: 'diffed', systemOwner: 'diffed',
    ownership: 'diffed', ppjtiRelatedParty: 'diffed',
  } satisfies Record<keyof Deliverable, FieldPolicy>,
  deliverableSegments: {
    id: identity, deliverableId: 'diffed', title: 'diffed', startDate: 'diffed',
    endDate: 'diffed', status: 'diffed', initiativeId: 'diffed',
    capexAmount: 'diffed', opexAmount: 'diffed', rptiRemarks: 'diffed',
    row: layout, rowSpan: layout,
  } satisfies Record<keyof DeliverableSegment, FieldPolicy>,
  deliverableStatuses: {
    id: identity, name: 'diffed', color: 'diffed', isLiveStatus: 'diffed',
    isPreLaunchStatus: 'diffed',
  } satisfies Record<keyof DeliverableStatus, FieldPolicy>,
  resources: {
    id: identity, name: 'diffed', role: 'diffed',
  } satisfies Record<keyof Resource, FieldPolicy>,
  assetCategories: {
    id: identity, name: 'diffed', order: 'diffed', categoryCode: 'diffed',
    dcCity: 'diffed', dcCountry: 'diffed', drCity: 'diffed', drCountry: 'diffed',
  } satisfies Record<keyof AssetCategory, FieldPolicy>,
  rptiDetails: {
    id: identity, initiativeId: 'diffed', targetType: 'diffed', targetId: 'diffed',
    categoryCode: 'diffed', developmentType: 'diffed', developer: 'diffed',
    ppjtiRelatedParty: 'diffed', dcCity: 'diffed', dcCountry: 'diffed',
    drCity: 'diffed', drCountry: 'diffed', plannedImplementationQuarter: 'diffed',
    deliverableSegmentId: 'diffed', remarks: 'diffed',
  } satisfies Record<keyof RptiDetail, FieldPolicy>,
  lkptiDetails: {
    id: identity, targetId: 'diffed', targetName: 'diffed',
    categoryCode: 'diffed', developer: 'diffed', dcCity: 'diffed',
    dcCountry: 'diffed', drCity: 'diffed', drCountry: 'diffed',
    platform: 'diffed', database: 'diffed', dcProvider: 'diffed',
    drcProvider: 'diffed', backupStrategy: 'diffed', systemOwner: 'diffed',
    goLiveDate: 'diffed', ownership: 'diffed', functionDescription: 'diffed',
  } satisfies Record<keyof LkptiDetail, FieldPolicy>,
} as const satisfies Record<DiffSectionKey, Record<string, FieldPolicy>>;
