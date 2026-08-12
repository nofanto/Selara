/**
 * Workspace templates for Selara.
 *
 * Each template defines the initial data loaded into IndexedDB on first run.
 */

import { Asset, AssetCategory, Decision, RptiDetail, Initiative, Milestone, DeliverableSegment, Programme, Strategy, Dependency, Resource, DeliverableStatus, TimelineSettings, Deliverable } from '../types';
import {
  demoAssets,
  demoInitiatives,
  demoMilestones,
  demoDeliverableSegments,
  demoAssetCategories,
  demoProgrammes,
  demoStrategies,
  demoDependencies,
  demoResources,
  demoDeliverables,
  demoDeliverableStatuses,
  demoTimelineSettings,
} from '../demoData';

export type TemplateId = 'geanz' | 'viewer' | 'blank';

export interface WorkspaceTemplate {
  id: TemplateId;
  name: string;
  description: string;
  tagline: string;
}

export const WORKSPACE_TEMPLATES: WorkspaceTemplate[] = [
  {
    id: 'geanz',
    name: 'GEANZ Technology Catalogue',
    description: 'Browse 17 TAP application areas and add the ones relevant to your agency.',
    tagline: '17 areas · 300+ asset types',
  },
  {
    id: 'viewer',
    name: 'Viewer',
    description: 'Upload an Excel file shared by a colleague to view their portfolio.',
    tagline: 'Upload & view a shared file',
  },
  {
    id: 'blank',
    name: 'Blank',
    description: 'Start from scratch with your own asset categories.',
    tagline: 'Your own structure',
  },
];

export interface TemplateAppData {
  assetCategories: AssetCategory[];
  assets: Asset[];
  initiatives: Initiative[];
  milestones: Milestone[];
  deliverableSegments: DeliverableSegment[];
  programmes: Programme[];
  strategies: Strategy[];
  dependencies: Dependency[];
  resources: Resource[];
  deliverables: Deliverable[];
  deliverableStatuses: DeliverableStatus[];
  decisions: Decision[];
  rptiDetails: RptiDetail[];
  timelineSettings: TimelineSettings;
}

export function getTemplateData(templateId: TemplateId | string, withDemoData = true): TemplateAppData {
  const baseSettings: TimelineSettings = {
    ...demoTimelineSettings,
    templateId,
  };

  switch (templateId) {
    case 'viewer':
      // Viewer mode loads data from an uploaded Excel file — no preset data needed.
      // Return a blank workspace as the fallback.
      return {
        assetCategories: [],
        assets: [],
        initiatives: [],
        milestones: [],
        deliverableSegments: [],
        programmes: [],
        strategies: [],
        dependencies: [],
        resources: [],
        deliverables: [],
        deliverableStatuses: [],
        decisions: [],
        rptiDetails: [],
        timelineSettings: { ...baseSettings, showGeanzCatalogue: false },
      };

    case 'blank':
      return {
        assetCategories: [],
        assets: [],
        initiatives: [],
        milestones: [],
        deliverableSegments: [],
        programmes: [],
        strategies: [],
        dependencies: [],
        resources: [],
        deliverables: [],
        deliverableStatuses: [],
        decisions: [],
        rptiDetails: [],
        timelineSettings: { ...baseSettings, showGeanzCatalogue: false },
      };

    case 'geanz':
    default:
      return {
        assetCategories: demoAssetCategories,
        assets: demoAssets,
        initiatives: withDemoData ? demoInitiatives : [],
        milestones: withDemoData ? demoMilestones : [],
        deliverableSegments: withDemoData ? demoDeliverableSegments : [],
        programmes: demoProgrammes,
        strategies: demoStrategies,
        dependencies: withDemoData ? demoDependencies : [],
        resources: withDemoData ? demoResources : [],
        deliverables: withDemoData ? demoDeliverables : [],
        deliverableStatuses: demoDeliverableStatuses,
        decisions: [],
        rptiDetails: [],
        timelineSettings: { ...baseSettings, showGeanzCatalogue: true },
      };
  }
}
