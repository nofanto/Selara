import React, { useState } from 'react';
import { Asset, Deliverable, DeliverableSegment, DeliverableStatus, DeliverableType, Decision, RptiDetail, LkptiDetail, Initiative, Milestone, Programme, Strategy, Dependency, AssetCategory, TimelineSettings, Resource } from '../types';
import { EditableTable, Column } from './EditableTable';
import { cn } from '../lib/utils';
import { Database, Layers, Calendar, Flag, Target, Link2, FolderTree, LayoutTemplate, Users, Box, ClipboardList, ListChecks, RefreshCw } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';
import { clearDeliverablesAndSegments, removeDeliverableAndSegments } from '../lib/deliverableCascade';
import { rptiCascadeOnInitiativeDelete, rptiCascadeOnDeliverableDelete, rptiCascadeOnAssetDelete, RPTI_CATEGORY_LABELS, generateRptiDetails } from '../lib/rpti';
import { lkptiCascadeOnDeliverableDelete, generateLkptiDetails, LKPTI_CATEGORY_CODES } from '../lib/lkpti';

interface DataManagerProps {
  data: {
    assets: Asset[];
    deliverables: Deliverable[];
    deliverableSegments: DeliverableSegment[];
    initiatives: Initiative[];
    milestones: Milestone[];
    programmes: Programme[];
    strategies: Strategy[];
    dependencies: Dependency[];
    assetCategories: AssetCategory[];
    timelineSettings: TimelineSettings;
    resources: Resource[];
    deliverableStatuses: DeliverableStatus[];
    decisions: Decision[];
    rptiDetails: RptiDetail[];
    lkptiDetails: LkptiDetail[];
  };
  onUpdate: (data: {
    assets: Asset[];
    deliverables: Deliverable[];
    deliverableSegments: DeliverableSegment[];
    initiatives: Initiative[];
    milestones: Milestone[];
    programmes: Programme[];
    strategies: Strategy[];
    dependencies: Dependency[];
    assetCategories: AssetCategory[];
    timelineSettings: TimelineSettings;
    resources: Resource[];
    deliverableStatuses: DeliverableStatus[];
    decisions: Decision[];
    rptiDetails: RptiDetail[];
    lkptiDetails: LkptiDetail[];
  }) => void;
  onOpenTemplatePicker: () => void;
  searchQuery?: string;
}

type Tab = 'initiatives' | 'dependencies' | 'assets' | 'assetCategories' | 'programmes' | 'strategies' | 'milestones' | 'resources' | 'deliverables' | 'deliverableStatuses' | 'rpti' | 'lkpti';

export function DataManager({ data, onUpdate, onOpenTemplatePicker, searchQuery }: DataManagerProps) {
  const [activeTab, setActiveTab] = useState<Tab>('initiatives');
  const [pendingConfirm, setPendingConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const confirm = (title: string, message: string, action: () => void) => {
    setPendingConfirm({ title, message, onConfirm: () => { setPendingConfirm(null); action(); } });
  };

  const updateData = <K extends keyof typeof data>(key: K, newData: (typeof data)[K]) => {
    onUpdate({
      ...data,
      [key]: newData
    });
  };

  // Shared helper: builds the confirm dialog and triggers the cascading update.
  const cascadeDelete = (
    title: string,
    entityName: string,
    cascadeParts: string[],
    updates: Partial<typeof data>,
    customMsg?: string
  ): boolean => {
    const msg = customMsg ?? (cascadeParts.length
      ? `Deleting "${entityName}" will also remove ${cascadeParts.join(', ')}. Continue?`
      : `Delete "${entityName}"?`);
    confirm(title, msg, () => onUpdate({ ...data, ...updates }));
    return true;
  };

  // Cascading delete handlers
  const handleDeleteAsset = (asset: Asset): boolean => {
    const affectedInits = data.initiatives.filter(i => i.assetId === asset.id);
    const affectedMiles = data.milestones.filter(m => m.assetId === asset.id);
    const affectedInitIds = new Set(affectedInits.map(i => i.id));
    const affectedDeps = data.dependencies.filter(d => affectedInitIds.has(d.sourceId) || affectedInitIds.has(d.targetId));
    const affectedRptiFromInits = data.rptiDetails.filter(r => affectedInitIds.has(r.initiativeId)).length;
    const affectedRptiFromAsset = data.rptiDetails.filter(r => r.targetType === 'asset' && r.targetId === asset.id).length;
    const affectedRpti = affectedRptiFromInits + affectedRptiFromAsset;
    const parts = [];
    if (affectedInits.length) parts.push(`${affectedInits.length} initiative(s)`);
    if (affectedMiles.length) parts.push(`${affectedMiles.length} milestone(s)`);
    if (affectedDeps.length) parts.push(`${affectedDeps.length} dependency(ies)`);
    if (affectedRpti) parts.push(`${affectedRpti} RPTI report row(s)`);
    return cascadeDelete('Delete Asset', asset.name, parts, {
      assets: data.assets.filter(a => a.id !== asset.id),
      initiatives: data.initiatives.filter(i => i.assetId !== asset.id),
      milestones: data.milestones.filter(m => m.assetId !== asset.id),
      dependencies: data.dependencies.filter(d => !affectedInitIds.has(d.sourceId) && !affectedInitIds.has(d.targetId)),
      rptiDetails: rptiCascadeOnAssetDelete(
        data.rptiDetails.filter(r => !affectedInitIds.has(r.initiativeId)),
        asset.id
      ),
    });
  };

  const handleDeleteProgramme = (prog: Programme): boolean => {
    const affectedInits = data.initiatives.filter(i => i.programmeId === prog.id);
    const affectedInitIds = new Set(affectedInits.map(i => i.id));
    const affectedDeps = data.dependencies.filter(d => affectedInitIds.has(d.sourceId) || affectedInitIds.has(d.targetId));
    const parts = [];
    if (affectedInits.length) parts.push(`${affectedInits.length} initiative(s)`);
    if (affectedDeps.length) parts.push(`${affectedDeps.length} dependency(ies)`);
    return cascadeDelete('Delete Programme', prog.name, parts, {
      programmes: data.programmes.filter(p => p.id !== prog.id),
      initiatives: data.initiatives.filter(i => i.programmeId !== prog.id),
      dependencies: data.dependencies.filter(d => !affectedInitIds.has(d.sourceId) && !affectedInitIds.has(d.targetId)),
    });
  };

  const handleDeleteStrategy = (strat: Strategy): boolean => {
    const affected = data.initiatives.filter(i => i.strategyId === strat.id);
    const customMsg = affected.length
      ? `Deleting "${strat.name}" will clear the strategy on ${affected.length} initiative(s). Continue?`
      : undefined;
    return cascadeDelete('Delete Strategy', strat.name, [], {
      strategies: data.strategies.filter(s => s.id !== strat.id),
      initiatives: data.initiatives.map(i => i.strategyId === strat.id ? { ...i, strategyId: undefined } : i),
    }, customMsg);
  };

  const handleDeleteInitiative = (init: Initiative): boolean => {
    const affectedDeps = data.dependencies.filter(d => d.sourceId === init.id || d.targetId === init.id);
    const affectedRpti = data.rptiDetails.filter(r => r.initiativeId === init.id).length;
    const parts = [];
    if (affectedDeps.length) parts.push(`${affectedDeps.length} dependency(ies)`);
    if (affectedRpti) parts.push(`${affectedRpti} RPTI report row(s)`);
    return cascadeDelete('Delete Initiative', init.name, parts, {
      initiatives: data.initiatives.filter(i => i.id !== init.id),
      dependencies: data.dependencies.filter(d => d.sourceId !== init.id && d.targetId !== init.id),
      rptiDetails: rptiCascadeOnInitiativeDelete(data.rptiDetails, init.id),
    });
  };

  const handleDeleteCategory = (cat: AssetCategory): boolean => {
    const affectedAssets = data.assets.filter(a => a.categoryId === cat.id);
    const affectedAssetIds = new Set(affectedAssets.map(a => a.id));
    const affectedInits = data.initiatives.filter(i => affectedAssetIds.has(i.assetId));
    const affectedInitIds = new Set(affectedInits.map(i => i.id));
    const affectedMiles = data.milestones.filter(m => affectedAssetIds.has(m.assetId));
    const affectedDeps = data.dependencies.filter(d => affectedInitIds.has(d.sourceId) || affectedInitIds.has(d.targetId));
    const parts = [];
    if (affectedAssets.length) parts.push(`${affectedAssets.length} asset(s)`);
    if (affectedInits.length) parts.push(`${affectedInits.length} initiative(s)`);
    if (affectedMiles.length) parts.push(`${affectedMiles.length} milestone(s)`);
    if (affectedDeps.length) parts.push(`${affectedDeps.length} dependency(ies)`);
    return cascadeDelete('Delete Category', cat.name, parts, {
      assetCategories: data.assetCategories.filter(c => c.id !== cat.id),
      assets: data.assets.filter(a => a.categoryId !== cat.id),
      initiatives: data.initiatives.filter(i => !affectedAssetIds.has(i.assetId)),
      milestones: data.milestones.filter(m => !affectedAssetIds.has(m.assetId)),
      dependencies: data.dependencies.filter(d => !affectedInitIds.has(d.sourceId) && !affectedInitIds.has(d.targetId)),
    });
  };

  const assetOptions = data.assets.map(a => ({ value: a.id, label: a.name }));
  const programmeOptions = data.programmes.map(p => ({ value: p.id, label: p.name }));
  const strategyOptions = data.strategies.map(s => ({ value: s.id, label: s.name }));
  const initiativeOptions = data.initiatives.map(i => ({ value: i.id, label: i.name }));
  const categoryOptions = data.assetCategories.map(c => ({ value: c.id, label: c.name }));
  const deliverableOptions = (data.deliverables || []).map(a => ({ value: a.id, label: a.name }));
  const rptiTargetOptions = [
    ...deliverableOptions.map(o => ({ value: o.value, label: `Deliverable: ${o.label}` })),
    ...assetOptions.map(o => ({ value: o.value, label: `Asset: ${o.label}` })),
  ];

  // Recomputes each row's targetType from whichever list (deliverables vs assets)
  // its current targetId is actually found in, so targetId is the single source
  // of truth and the two fields can never fall out of sync via inline editing.
  const deriveRptiTargetTypes = (rows: RptiDetail[]): RptiDetail[] => {
    return rows.map(row => {
      if ((data.deliverables || []).some(a => a.id === row.targetId)) return { ...row, targetType: 'deliverable' as const };
      if (data.assets.some(a => a.id === row.targetId)) return { ...row, targetType: 'asset' as const };
      return row;
    });
  };

  // Wipes and rebuilds all RPTI rows from the current year's DeliverableSegment data —
  // see requirement-specs/rpti-auto-generation.md. v1: full replace, no reconciliation
  // with prior manual edits.
  const handleGenerateRpti = () => {
    const reportYear = new Date().getFullYear();
    const generated = generateRptiDetails({
      deliverableSegments: data.deliverableSegments || [],
      deliverableStatuses: data.deliverableStatuses || [],
      initiatives: data.initiatives,
      deliverables: data.deliverables || [],
      assets: data.assets,
      assetCategories: data.assetCategories,
    }, reportYear);
    const existingCount = (data.rptiDetails || []).length;
    const message = existingCount
      ? `This replaces all ${existingCount} existing RPTI row(s) with ${generated.length} row(s) generated from ${reportYear} deliverable segment data. Any manual edits will be lost. Continue?`
      : `Generate ${generated.length} RPTI row(s) from ${reportYear} deliverable segment data?`;
    confirm('Generate RPTI Rows', message, () => updateData('rptiDetails', generated));
  };

  // Wipes and rebuilds all LKPTI rows from currently-live Deliverables —
  // see requirement-specs/lkpti-integration.md §3. Unlike RPTI, this isn't
  // scoped to a report year: it's a point-in-time inventory, not a plan of activity.
  const handleGenerateLkpti = () => {
    const generated = generateLkptiDetails({
      deliverableSegments: data.deliverableSegments || [],
      deliverableStatuses: data.deliverableStatuses || [],
      deliverables: data.deliverables || [],
      assets: data.assets,
      assetCategories: data.assetCategories,
    });
    const existingCount = (data.lkptiDetails || []).length;
    const message = existingCount
      ? `This replaces all ${existingCount} existing LKPTI row(s) with ${generated.length} row(s) generated from currently-live deliverables. Any manual edits will be lost. Continue?`
      : `Generate ${generated.length} LKPTI row(s) from currently-live deliverables?`;
    confirm('Generate LKPTI Rows', message, () => updateData('lkptiDetails', generated));
  };

  const initiativeColumns: Column<Initiative>[] = [
    { key: 'name', label: 'Initiative Name', type: 'text', width: '180px' },
    { key: 'assetId', label: 'Asset', type: 'select', options: assetOptions, width: '120px' },
    { key: 'programmeId', label: 'Programme', type: 'select', options: programmeOptions, width: '110px' },
    { key: 'strategyId', label: 'Strategy', type: 'select', options: strategyOptions, width: '110px' },
    { key: 'startDate', label: 'Start Date', type: 'date', width: '120px' },
    { key: 'endDate', label: 'End Date', type: 'date', width: '120px' },
    { key: 'capex', label: `CapEx (${data.timelineSettings.defaultCurrency || 'USD'})`, type: 'number', width: '100px' },
    { key: 'opex', label: `OpEx (${data.timelineSettings.defaultCurrency || 'USD'})`, type: 'number', width: '100px' },
    { key: 'status', label: 'Status', type: 'select', options: [
      { value: 'planned', label: 'Planned' },
      { value: 'active', label: 'Active' },
      { value: 'done', label: 'Done' },
      { value: 'cancelled', label: 'Cancelled' },
    ], width: '100px' },
    { key: 'ragStatus', label: 'RAG Status', type: 'select', options: [
      { value: '', label: '— None —' },
      { value: 'green', label: 'Green' },
      { value: 'amber', label: 'Amber' },
      { value: 'red', label: 'Red' },
    ], width: '100px' },
    { key: 'progress', label: 'Progress (%)', type: 'number', width: '90px' },
    { key: 'owner', label: 'Owner', type: 'text', width: '110px' },
    { key: 'isPlaceholder', label: 'Placeholder?', type: 'boolean', width: '80px' },
    { key: 'description', label: 'Description', type: 'textarea', width: '220px', placeholder: 'Add a description...' },
  ];

  const assetColumns: Column<Asset>[] = [
    { key: 'name', label: 'Asset Name', type: 'text', width: '40%' },
    { key: 'categoryId', label: 'Category', type: 'select', options: categoryOptions, width: '40%' },
    { key: 'maturity', label: 'Maturity', type: 'select', options: [
      { value: '', label: '— Unrated —' },
      { value: '1', label: '1 – Emergent' },
      { value: '2', label: '2 – Developing' },
      { value: '3', label: '3 – Defined' },
      { value: '4', label: '4 – Managed' },
      { value: '5', label: '5 – Optimised' },
    ], width: '20%' },
  ];

  const categoryColumns: Column<AssetCategory>[] = [
    { key: 'name', label: 'Category Name', type: 'text', width: '200px' },
    { key: 'order', label: 'Sort Order', type: 'number', width: '100px' },
    {
      key: 'categoryCode', label: 'Default RPTI Category', type: 'select', width: '220px',
      options: [
        { value: '', label: '— Not set —' },
        ...(Object.keys(RPTI_CATEGORY_LABELS) as (keyof typeof RPTI_CATEGORY_LABELS)[])
          .map(code => ({ value: code, label: `${code} — ${RPTI_CATEGORY_LABELS[code]}` })),
      ],
    },
    { key: 'dcCity', label: 'Default DC City', type: 'text', width: '130px' },
    { key: 'dcCountry', label: 'Default DC Country', type: 'text', width: '130px' },
    { key: 'drCity', label: 'Default DR City', type: 'text', width: '130px' },
    { key: 'drCountry', label: 'Default DR Country', type: 'text', width: '130px' },
  ];

  const programmeColumns: Column<Programme>[] = [
    { key: 'name', label: 'Programme Name', type: 'text', width: '60%' },
    { key: 'color', label: 'Color', type: 'color', width: '40%' },
  ];

  const strategyColumns: Column<Strategy>[] = [
    { key: 'name', label: 'Strategy Name', type: 'text', width: '60%' },
    { key: 'color', label: 'Color', type: 'color', width: '40%' },
  ];

  const milestoneColumns: Column<Milestone>[] = [
    { key: 'name', label: 'Milestone Name', type: 'text', width: '30%' },
    { key: 'assetId', label: 'Asset', type: 'select', options: assetOptions, width: '20%' },
    { key: 'date', label: 'Date', type: 'date', width: '20%' },
    {
      key: 'type', label: 'Type', type: 'select', options: [
        { value: 'info', label: 'Info' },
        { value: 'warning', label: 'Warning' },
        { value: 'critical', label: 'Critical' }
      ], width: '20%'
    },
  ];

  const dependencyColumns: Column<Dependency>[] = [
    { key: 'sourceId', label: 'Dependent Initiative', type: 'select', options: initiativeOptions, width: '35%' },
    { key: 'targetId', label: 'Depends On', type: 'select', options: initiativeOptions, width: '35%' },
    {
      key: 'type', label: 'Dependency Type', type: 'select', options: [
        { value: 'blocks', label: 'Blocks' },
        { value: 'requires', label: 'Requires' },
        { value: 'related', label: 'Related' }
      ], width: '20%'
    },
  ];

  const handleColumnResize = (tableId: Tab, columnKey: string, newWidth: string) => {
    const updatedWidths = {
      ...(data.timelineSettings.columnWidths || {}),
      [tableId]: {
        ...(data.timelineSettings.columnWidths?.[tableId] || {}),
        [columnKey]: newWidth
      }
    };

    onUpdate({
      ...data,
      timelineSettings: {
        ...data.timelineSettings,
        columnWidths: updatedWidths
      }
    });
  };

  const getColumnsWithWidths = <T extends { [key: string]: any }>(tabId: Tab, baseColumns: Column<T>[]): Column<T>[] => {
    const savedWidths = data.timelineSettings.columnWidths?.[tabId] || {};
    return baseColumns.map(col => ({
      ...col,
      width: savedWidths[String(col.key)] || col.width
    }));
  };

  const resourceColumns: Column<Resource>[] = [
    { key: 'name', label: 'Name', type: 'text', width: '50%' },
    { key: 'role', label: 'Role', type: 'text', width: '50%' },
  ];

  const deliverableColumns: Column<Deliverable>[] = [
    { key: 'name', label: 'Name', type: 'text', width: '180px' },
    {
      key: 'type', label: 'Type', type: 'select', width: '130px',
      options: (['application', 'infrastructure', 'document', 'procedure', 'other'] as DeliverableType[])
        .map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) })),
    },
    {
      key: 'assetId', label: 'Asset', type: 'select', width: '160px',
      options: data.assets.map(a => ({ value: a.id, label: a.name })),
    },
    { key: 'description', label: 'Description', type: 'textarea', width: '220px' },
    {
      key: 'categoryCode', label: 'RPTI Category Override', type: 'select', width: '220px',
      options: [
        { value: '', label: '— Use category default —' },
        ...(Object.keys(RPTI_CATEGORY_LABELS) as (keyof typeof RPTI_CATEGORY_LABELS)[])
          .map(code => ({ value: code, label: `${code} — ${RPTI_CATEGORY_LABELS[code]}` })),
      ],
    },
    {
      key: 'developer', label: 'Developer', type: 'select', width: '110px',
      options: [
        { value: '', label: '— Not set —' },
        { value: 'inhouse', label: 'In-house' }, { value: 'PPJTI', label: 'PPJTI' },
      ],
    },
    { key: 'dcCity', label: 'DC City Override', type: 'text', width: '130px' },
    { key: 'dcCountry', label: 'DC Country Override', type: 'text', width: '130px' },
    { key: 'drCity', label: 'DR City Override', type: 'text', width: '130px' },
    { key: 'drCountry', label: 'DR Country Override', type: 'text', width: '130px' },
  ];

  const handleDeleteDeliverable = (deliverable: Deliverable): boolean => {
    const affectedSegments = data.deliverableSegments.filter(segment => segment.deliverableId === deliverable.id);
    const affectedRpti = data.rptiDetails.filter(r => r.targetType === 'deliverable' && r.targetId === deliverable.id).length;
    const affectedAppInv = (data.lkptiDetails || []).filter(r => r.targetId === deliverable.id).length;
    const parts = [];
    if (affectedSegments.length) parts.push(`${affectedSegments.length} segment(s)`);
    if (affectedRpti) parts.push(`${affectedRpti} RPTI report row(s)`);
    if (affectedAppInv) parts.push(`${affectedAppInv} LKPTI report row(s)`);
    const msg = parts.length
      ? `Deleting "${deliverable.name}" will also remove ${parts.join(', ')}. Continue?`
      : undefined;
    return cascadeDelete('Delete Deliverable', deliverable.name, parts, {
      ...removeDeliverableAndSegments(
        { deliverables: data.deliverables || [], deliverableSegments: data.deliverableSegments || [] },
        deliverable.id,
      ),
      rptiDetails: rptiCascadeOnDeliverableDelete(data.rptiDetails, deliverable.id),
      lkptiDetails: lkptiCascadeOnDeliverableDelete(data.lkptiDetails || [], deliverable.id),
    }, msg);
  };

  const handleClearDeliverables = (): boolean => {
    const segmentCount = data.deliverableSegments.length;
    const affectedRpti = data.rptiDetails.filter(r => r.targetType === 'deliverable').length;
    const affectedAppInv = (data.lkptiDetails || []).length;
    const parts = [];
    if ((data.deliverables || []).length) parts.push(`${(data.deliverables || []).length} deliverable(s)`);
    if (segmentCount) parts.push(`${segmentCount} segment(s)`);
    if (affectedRpti) parts.push(`${affectedRpti} RPTI report row(s)`);
    if (affectedAppInv) parts.push(`${affectedAppInv} LKPTI report row(s)`);
    return cascadeDelete('Delete All Deliverables', 'all deliverables', parts, {
      ...clearDeliverablesAndSegments(),
      rptiDetails: data.rptiDetails.filter(r => r.targetType !== 'deliverable'),
      lkptiDetails: [],
    }, parts.length
      ? `Deleting all deliverables will also remove ${parts.join(', ')}. Continue?`
      : 'Delete all deliverables?');
  };

  const deliverableStatusColumns: Column<DeliverableStatus>[] = [
    { key: 'name', label: 'Status Name', type: 'text', width: '40%' },
    { key: 'color', label: 'Color', type: 'color', width: '20%' },
    { key: 'isLiveStatus', label: 'Live?', type: 'boolean', width: '20%' },
    { key: 'isPreLaunchStatus', label: 'Pre-Launch?', type: 'boolean', width: '20%' },
  ];

  const rptiColumns: Column<RptiDetail>[] = [
    { key: 'initiativeId', label: 'Initiative', type: 'select', options: initiativeOptions, width: '150px' },
    { key: 'targetId', label: 'Target', type: 'select', options: rptiTargetOptions, width: '160px' },
    {
      key: 'categoryCode', label: 'Category', type: 'select', width: '220px',
      options: [
        { value: '', label: '— Not set —' },
        ...(Object.keys(RPTI_CATEGORY_LABELS) as (keyof typeof RPTI_CATEGORY_LABELS)[])
          .map(code => ({ value: code, label: `${code} — ${RPTI_CATEGORY_LABELS[code]}` })),
      ],
    },
    {
      key: 'developmentType', label: 'Dev Type', type: 'select', width: '110px',
      options: [{ value: 'new', label: 'New' }, { value: 'upgrade', label: 'Upgrade' }],
    },
    {
      key: 'developer', label: 'Developer', type: 'select', width: '110px',
      options: [
        { value: '', label: '— Not set —' },
        { value: 'inhouse', label: 'In-house' }, { value: 'PPJTI', label: 'PPJTI' },
      ],
    },
    {
      key: 'ppjtiRelatedParty', label: 'PPJTI Related Party', type: 'select', width: '150px',
      options: [
        { value: '', label: '— Not set —' },
        { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'n/a', label: 'N/A' },
      ],
    },
    {
      key: 'plannedImplementationQuarter', label: 'Quarter', type: 'select', width: '100px',
      options: [
        { value: '', label: '— Not set —' },
        { value: 'Q1', label: 'Q1' }, { value: 'Q2', label: 'Q2' }, { value: 'Q3', label: 'Q3' }, { value: 'Q4', label: 'Q4' },
      ],
    },
    { key: 'capexAmount', label: 'CapEx Override', type: 'number', width: '140px' },
    { key: 'opexAmount', label: 'OpEx Override', type: 'number', width: '140px' },
    { key: 'dcCity', label: 'DC City', type: 'text', width: '110px' },
    { key: 'dcCountry', label: 'DC Country', type: 'text', width: '110px' },
    { key: 'drCity', label: 'DR City', type: 'text', width: '110px' },
    { key: 'drCountry', label: 'DR Country', type: 'text', width: '110px' },
    { key: 'remarks', label: 'Remarks', type: 'textarea', width: '200px' },
  ];

  const lkptiColumns: Column<LkptiDetail>[] = [
    { key: 'targetId', label: 'Deliverable', type: 'select', options: deliverableOptions, width: '160px' },
    {
      key: 'categoryCode', label: 'Category', type: 'select', width: '220px',
      options: [
        { value: '', label: '— Not set —' },
        ...LKPTI_CATEGORY_CODES.map(code => ({ value: code, label: `${code} — ${RPTI_CATEGORY_LABELS[code]}` })),
      ],
    },
    { key: 'functionDescription', label: 'Function Description', type: 'textarea', width: '220px' },
    { key: 'platform', label: 'Platform', type: 'text', width: '150px' },
    { key: 'database', label: 'Database', type: 'text', width: '150px' },
    { key: 'dcCity', label: 'DC City', type: 'text', width: '110px' },
    { key: 'dcCountry', label: 'DC Country', type: 'text', width: '110px' },
    { key: 'dcProvider', label: 'DC Provider', type: 'text', width: '140px', placeholder: "'self' or company name" },
    { key: 'drCity', label: 'DR City', type: 'text', width: '110px' },
    { key: 'drCountry', label: 'DR Country', type: 'text', width: '110px' },
    { key: 'drcProvider', label: 'DRC Provider', type: 'text', width: '140px', placeholder: "'self' or company name" },
    {
      key: 'backupStrategy', label: 'Backup Strategy', type: 'select', width: '180px',
      options: [
        { value: '', label: '— Not set —' },
        { value: 'HA_ACTIVE_ACTIVE', label: 'HA Active-Active' },
        { value: 'HA_ACTIVE_PASSIVE', label: 'HA Active-Passive' },
        { value: 'BACKUP_REALTIME', label: 'Backup Realtime' },
        { value: 'BACKUP_PERIODIC', label: 'Backup Periodic' },
      ],
    },
    { key: 'systemOwner', label: 'System Owner', type: 'text', width: '150px' },
    { key: 'developer', label: 'Developer', type: 'text', width: '150px', placeholder: "'inhouse' or provider name" },
    { key: 'goLiveDate', label: 'Go-Live Date (dd-mm-yyyy)', type: 'text', width: '150px' },
    {
      key: 'ownership', label: 'Ownership', type: 'select', width: '130px',
      options: [
        { value: '', label: '— Not set —' },
        { value: 'LEASE', label: 'Lease' },
        { value: 'OUTRIGHT_PURCHASE', label: 'Outright Purchase' },
      ],
    },
  ];

  const tabs = [
    { id: 'initiatives', label: 'Initiatives', icon: Layers, count: data.initiatives.length },
    { id: 'dependencies', label: 'Dependencies', icon: Link2, count: data.dependencies.length },
    { id: 'assets', label: 'Assets', icon: Database, count: data.assets.length },
    { id: 'deliverables', label: 'Deliverables', icon: Box, count: (data.deliverables || []).length },
    { id: 'assetCategories', label: 'Categories', icon: FolderTree, count: data.assetCategories.length },
    { id: 'programmes', label: 'Programmes', icon: Calendar, count: data.programmes.length },
    { id: 'strategies', label: 'Strategies', icon: Target, count: data.strategies.length },
    { id: 'milestones', label: 'Milestones', icon: Flag, count: data.milestones.length },
    { id: 'resources', label: 'Resources', icon: Users, count: (data.resources || []).length },
    { id: 'deliverableStatuses', label: 'Deliverable Statuses', icon: Layers, count: (data.deliverableStatuses || []).length },
    { id: 'rpti', label: 'RPTI', icon: ClipboardList, count: (data.rptiDetails || []).length },
    { id: 'lkpti', label: 'LKPTI', icon: ListChecks, count: (data.lkptiDetails || []).length },
  ];

  return (
    <div data-testid="data-manager" className="flex flex-col h-full bg-slate-50 border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="flex flex-wrap border-b border-slate-200 bg-white">
        {tabs.map(tab => (
          <button
            key={tab.id}
            data-testid={`data-manager-tab-${tab.id}`}
            aria-pressed={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              activeTab === tab.id
                ? "border-blue-500 text-blue-600 bg-blue-50"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            )}
          >
            <tab.icon size={16} />
            {tab.label}
            <span className="ml-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <div className="flex-1 p-6 overflow-hidden">
        {activeTab === 'initiatives' && (
          <EditableTable
            data={data.initiatives}
            columns={getColumnsWithWidths('initiatives', initiativeColumns)}
            onUpdate={(newData) => updateData('initiatives', newData)}
            onDelete={handleDeleteInitiative}
            idField="id"
            searchQuery={searchQuery}
            tableId="initiatives"
            onColumnResize={(key, width) => handleColumnResize('initiatives', key, width)}
          />
        )}
        {activeTab === 'dependencies' && (
          <EditableTable
            data={data.dependencies}
            columns={getColumnsWithWidths('dependencies', dependencyColumns)}
            onUpdate={(newData) => updateData('dependencies', newData)}
            idField="id"
            searchQuery={searchQuery}
            tableId="dependencies"
            onColumnResize={(key, width) => handleColumnResize('dependencies', key, width)}
          />
        )}
        {activeTab === 'assets' && (
          <EditableTable
            data={data.assets}
            columns={getColumnsWithWidths('assets', assetColumns)}
            onUpdate={(newData) => updateData('assets', newData)}
            onDelete={handleDeleteAsset}
            idField="id"
            searchQuery={searchQuery}
            tableId="assets"
            onColumnResize={(key, width) => handleColumnResize('assets', key, width)}
          />
        )}
        {activeTab === 'assetCategories' && (
          <EditableTable
            data={data.assetCategories}
            columns={getColumnsWithWidths('assetCategories', categoryColumns)}
            onUpdate={(newData) => updateData('assetCategories', newData)}
            onDelete={handleDeleteCategory}
            idField="id"
            searchQuery={searchQuery}
            tableId="assetCategories"
            onColumnResize={(key, width) => handleColumnResize('assetCategories', key, width)}
          />
        )}
        {activeTab === 'programmes' && (
          <EditableTable
            data={data.programmes}
            columns={getColumnsWithWidths('programmes', programmeColumns)}
            onUpdate={(newData) => updateData('programmes', newData)}
            onDelete={handleDeleteProgramme}
            idField="id"
            searchQuery={searchQuery}
            tableId="programmes"
            onColumnResize={(key, width) => handleColumnResize('programmes', key, width)}
          />
        )}
        {activeTab === 'strategies' && (
          <EditableTable
            data={data.strategies}
            columns={getColumnsWithWidths('strategies', strategyColumns)}
            onUpdate={(newData) => updateData('strategies', newData)}
            onDelete={handleDeleteStrategy}
            idField="id"
            searchQuery={searchQuery}
            tableId="strategies"
            onColumnResize={(key, width) => handleColumnResize('strategies', key, width)}
          />
        )}
        {activeTab === 'milestones' && (
          <EditableTable
            data={data.milestones}
            columns={getColumnsWithWidths('milestones', milestoneColumns)}
            onUpdate={(newData) => updateData('milestones', newData)}
            idField="id"
            searchQuery={searchQuery}
            tableId="milestones"
            onColumnResize={(key, width) => handleColumnResize('milestones', key, width)}
          />
        )}
        {activeTab === 'resources' && (
          <EditableTable
            data={data.resources || []}
            columns={getColumnsWithWidths('resources', resourceColumns)}
            onUpdate={(newData) => updateData('resources', newData)}
            idField="id"
            searchQuery={searchQuery}
            tableId="resources"
            onColumnResize={(key, width) => handleColumnResize('resources', key, width)}
          />
        )}
        {activeTab === 'deliverables' && (
          <EditableTable
            data={data.deliverables || []}
            columns={getColumnsWithWidths('deliverables', deliverableColumns)}
            onUpdate={(newData) => updateData('deliverables', newData)}
            onDelete={handleDeleteDeliverable}
            onClearAll={handleClearDeliverables}
            idField="id"
            searchQuery={searchQuery}
            tableId="deliverables"
            onColumnResize={(key, width) => handleColumnResize('deliverables', key, width)}
          />
        )}
        {activeTab === 'deliverableStatuses' && (
          <EditableTable
            data={data.deliverableStatuses || []}
            columns={getColumnsWithWidths('deliverableStatuses', deliverableStatusColumns)}
            onUpdate={(newData) => updateData('deliverableStatuses', newData)}
            onDelete={(status) => { updateData('deliverableStatuses', (data.deliverableStatuses || []).filter(s => s.id !== status.id)); return true; }}
            idField="id"
            tableId="deliverableStatuses"
            onColumnResize={(col, w) => handleColumnResize('deliverableStatuses', col, w)}
          />
        )}
        {activeTab === 'rpti' && (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={handleGenerateRpti}
                data-testid="rpti-generate-btn"
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium text-sm"
              >
                <RefreshCw size={16} />
                Generate {new Date().getFullYear()} RPTI Rows
              </button>
              <p className="text-xs text-slate-500">
                Rebuilds rows from this year's deliverable segments — replaces all rows below.
              </p>
              <div className="flex items-center gap-2 ml-auto">
                <label htmlFor="rpti-default-currency" className="text-xs text-slate-500 whitespace-nowrap">
                  Default Currency
                </label>
                <input
                  id="rpti-default-currency"
                  data-testid="rpti-default-currency-input"
                  type="text"
                  value={data.timelineSettings.defaultCurrency ?? ''}
                  onChange={(e) => updateData('timelineSettings', { ...data.timelineSettings, defaultCurrency: e.target.value })}
                  placeholder="e.g. IDR"
                  className="w-20 px-2 py-1 text-sm border border-slate-200 rounded-md"
                />
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-3 -mt-2">
              All CapEx/OpEx figures below are reported in this currency.
            </p>
            <EditableTable
              data={data.rptiDetails || []}
              columns={getColumnsWithWidths('rpti', rptiColumns)}
              onUpdate={(newData) => updateData('rptiDetails', deriveRptiTargetTypes(newData))}
              onDelete={(row) => { updateData('rptiDetails', (data.rptiDetails || []).filter(r => r.id !== row.id)); return true; }}
              idField="id"
              tableId="rpti"
              onColumnResize={(col, w) => handleColumnResize('rpti', col, w)}
            />
          </div>
        )}
        {activeTab === 'lkpti' && (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={handleGenerateLkpti}
                data-testid="lkpti-generate-btn"
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium text-sm"
              >
                <RefreshCw size={16} />
                Generate LKPTI Rows
              </button>
              <p className="text-xs text-slate-500">
                Rebuilds rows from currently-live deliverables — replaces all rows below.
              </p>
            </div>
            <EditableTable
              data={data.lkptiDetails || []}
              columns={getColumnsWithWidths('lkpti', lkptiColumns)}
              onUpdate={(newData) => updateData('lkptiDetails', newData)}
              onDelete={(row) => { updateData('lkptiDetails', (data.lkptiDetails || []).filter(r => r.id !== row.id)); return true; }}
              idField="id"
              tableId="lkpti"
              onColumnResize={(col, w) => handleColumnResize('lkpti', col, w)}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-200">
        <button
          data-testid="clear-and-start-again-btn"
          onClick={onOpenTemplatePicker}
          className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm font-medium text-sm"
        >
          <LayoutTemplate size={16} />
          Clear data and start again
        </button>
      </div>
      <ConfirmModal
        isOpen={pendingConfirm !== null}
        title={pendingConfirm?.title ?? ''}
        message={pendingConfirm?.message ?? ''}
        confirmLabel="Confirm"
        onConfirm={() => pendingConfirm?.onConfirm()}
        onCancel={() => setPendingConfirm(null)}
      />
    </div>
  );
}
