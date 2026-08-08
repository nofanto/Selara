import React, { useState } from 'react';
import { Asset, Application, ApplicationSegment, ApplicationStatus, DeliverableType, Decision, RptiDetail, Initiative, Milestone, Programme, Strategy, Dependency, AssetCategory, TimelineSettings, Resource } from '../types';
import { EditableTable, Column } from './EditableTable';
import { cn } from '../lib/utils';
import { Database, Layers, Calendar, Flag, Target, Link2, FolderTree, LayoutTemplate, Users, Box, ClipboardList } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';
import { clearApplicationsAndSegments, removeApplicationAndSegments } from '../lib/applicationCascade';
import { rptiCascadeOnInitiativeDelete, rptiCascadeOnApplicationDelete, rptiCascadeOnAssetDelete, RPTI_CATEGORY_LABELS } from '../lib/rpti';

interface DataManagerProps {
  data: {
    assets: Asset[];
    applications: Application[];
    applicationSegments: ApplicationSegment[];
    initiatives: Initiative[];
    milestones: Milestone[];
    programmes: Programme[];
    strategies: Strategy[];
    dependencies: Dependency[];
    assetCategories: AssetCategory[];
    timelineSettings: TimelineSettings;
    resources: Resource[];
    applicationStatuses: ApplicationStatus[];
    decisions: Decision[];
    rptiDetails: RptiDetail[];
  };
  onUpdate: (data: {
    assets: Asset[];
    applications: Application[];
    applicationSegments: ApplicationSegment[];
    initiatives: Initiative[];
    milestones: Milestone[];
    programmes: Programme[];
    strategies: Strategy[];
    dependencies: Dependency[];
    assetCategories: AssetCategory[];
    timelineSettings: TimelineSettings;
    resources: Resource[];
    applicationStatuses: ApplicationStatus[];
    decisions: Decision[];
    rptiDetails: RptiDetail[];
  }) => void;
  onOpenTemplatePicker: () => void;
  searchQuery?: string;
}

type Tab = 'initiatives' | 'dependencies' | 'assets' | 'assetCategories' | 'programmes' | 'strategies' | 'milestones' | 'resources' | 'applications' | 'appStatuses' | 'rpti';

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
  const applicationOptions = (data.applications || []).map(a => ({ value: a.id, label: a.name }));
  const rptiTargetOptions = [
    ...applicationOptions.map(o => ({ value: o.value, label: `App: ${o.label}` })),
    ...assetOptions.map(o => ({ value: o.value, label: `Asset: ${o.label}` })),
  ];

  // Recomputes each row's targetType from whichever list (applications vs assets)
  // its current targetId is actually found in, so targetId is the single source
  // of truth and the two fields can never fall out of sync via inline editing.
  const deriveRptiTargetTypes = (rows: RptiDetail[]): RptiDetail[] => {
    return rows.map(row => {
      if ((data.applications || []).some(a => a.id === row.targetId)) return { ...row, targetType: 'application' as const };
      if (data.assets.some(a => a.id === row.targetId)) return { ...row, targetType: 'asset' as const };
      return row;
    });
  };

  const initiativeColumns: Column<Initiative>[] = [
    { key: 'name', label: 'Initiative Name', type: 'text', width: '180px' },
    { key: 'assetId', label: 'Asset', type: 'select', options: assetOptions, width: '120px' },
    { key: 'programmeId', label: 'Programme', type: 'select', options: programmeOptions, width: '110px' },
    { key: 'strategyId', label: 'Strategy', type: 'select', options: strategyOptions, width: '110px' },
    { key: 'startDate', label: 'Start Date', type: 'date', width: '120px' },
    { key: 'endDate', label: 'End Date', type: 'date', width: '120px' },
    { key: 'capex', label: 'CapEx ($)', type: 'number', width: '100px' },
    { key: 'opex', label: 'OpEx ($)', type: 'number', width: '100px' },
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
    { key: 'name', label: 'Category Name', type: 'text', width: '80%' },
    { key: 'order', label: 'Sort Order', type: 'number', width: '20%' },
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

  const applicationColumns: Column<Application>[] = [
    { key: 'name', label: 'Name', type: 'text', width: '40%' },
    {
      key: 'type', label: 'Type', type: 'select', width: '25%',
      options: (['application', 'infrastructure', 'document', 'procedure', 'other'] as DeliverableType[])
        .map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) })),
    },
    {
      key: 'assetId', label: 'Asset', type: 'select', width: '35%',
      options: data.assets.map(a => ({ value: a.id, label: a.name })),
    },
  ];

  const handleDeleteApplication = (application: Application): boolean => {
    const affectedSegments = data.applicationSegments.filter(segment => segment.applicationId === application.id);
    const affectedRpti = data.rptiDetails.filter(r => r.targetType === 'application' && r.targetId === application.id).length;
    const parts = [];
    if (affectedSegments.length) parts.push(`${affectedSegments.length} segment(s)`);
    if (affectedRpti) parts.push(`${affectedRpti} RPTI report row(s)`);
    const msg = parts.length
      ? `Deleting "${application.name}" will also remove ${parts.join(', ')}. Continue?`
      : undefined;
    return cascadeDelete('Delete Deliverable', application.name, parts, {
      ...removeApplicationAndSegments(
        { applications: data.applications || [], applicationSegments: data.applicationSegments || [] },
        application.id,
      ),
      rptiDetails: rptiCascadeOnApplicationDelete(data.rptiDetails, application.id),
    }, msg);
  };

  const handleClearApplications = (): boolean => {
    const segmentCount = data.applicationSegments.length;
    const affectedRpti = data.rptiDetails.filter(r => r.targetType === 'application').length;
    const parts = [];
    if ((data.applications || []).length) parts.push(`${(data.applications || []).length} deliverable(s)`);
    if (segmentCount) parts.push(`${segmentCount} segment(s)`);
    if (affectedRpti) parts.push(`${affectedRpti} RPTI report row(s)`);
    return cascadeDelete('Delete All Deliverables', 'all deliverables', parts, {
      ...clearApplicationsAndSegments(),
      rptiDetails: data.rptiDetails.filter(r => r.targetType !== 'application'),
    }, parts.length
      ? `Deleting all applications will also remove ${parts.join(', ')}. Continue?`
      : 'Delete all applications?');
  };

  const appStatusColumns: Column<ApplicationStatus>[] = [
    { key: 'name', label: 'Status Name', type: 'text', width: '60%' },
    { key: 'color', label: 'Color', type: 'color', width: '40%' },
  ];

  const rptiColumns: Column<RptiDetail>[] = [
    { key: 'initiativeId', label: 'Initiative', type: 'select', options: initiativeOptions, width: '150px' },
    { key: 'targetId', label: 'Target', type: 'select', options: rptiTargetOptions, width: '160px' },
    {
      key: 'categoryCode', label: 'Category', type: 'select', width: '220px',
      options: (Object.keys(RPTI_CATEGORY_LABELS) as (keyof typeof RPTI_CATEGORY_LABELS)[])
        .map(code => ({ value: code, label: `${code} — ${RPTI_CATEGORY_LABELS[code]}` })),
    },
    {
      key: 'developmentType', label: 'Dev Type', type: 'select', width: '110px',
      options: [{ value: 'new', label: 'New' }, { value: 'upgrade', label: 'Upgrade' }],
    },
    {
      key: 'developer', label: 'Developer', type: 'select', width: '110px',
      options: [{ value: 'inhouse', label: 'In-house' }, { value: 'PPJTI', label: 'PPJTI' }],
    },
    {
      key: 'ppjtiRelatedParty', label: 'PPJTI Related Party', type: 'select', width: '150px',
      options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'n/a', label: 'N/A' }],
    },
    {
      key: 'plannedImplementationQuarter', label: 'Quarter', type: 'select', width: '100px',
      options: [
        { value: '', label: '— Not set —' },
        { value: 'Q1', label: 'Q1' }, { value: 'Q2', label: 'Q2' }, { value: 'Q3', label: 'Q3' }, { value: 'Q4', label: 'Q4' },
      ],
    },
    { key: 'capexAmount', label: 'CapEx Override ($)', type: 'number', width: '140px' },
    { key: 'capexCurrency', label: 'CapEx Currency', type: 'text', width: '110px' },
    { key: 'capexIdrEquivalent', label: 'CapEx IDR Equiv.', type: 'number', width: '140px' },
    { key: 'opexAmount', label: 'OpEx Override ($)', type: 'number', width: '140px' },
    { key: 'opexCurrency', label: 'OpEx Currency', type: 'text', width: '110px' },
    { key: 'opexIdrEquivalent', label: 'OpEx IDR Equiv.', type: 'number', width: '140px' },
    { key: 'dcCity', label: 'DC City', type: 'text', width: '110px' },
    { key: 'dcCountry', label: 'DC Country', type: 'text', width: '110px' },
    { key: 'drCity', label: 'DR City', type: 'text', width: '110px' },
    { key: 'drCountry', label: 'DR Country', type: 'text', width: '110px' },
    { key: 'remarks', label: 'Remarks', type: 'textarea', width: '200px' },
  ];

  const tabs = [
    { id: 'initiatives', label: 'Initiatives', icon: Layers, count: data.initiatives.length },
    { id: 'dependencies', label: 'Dependencies', icon: Link2, count: data.dependencies.length },
    { id: 'assets', label: 'Assets', icon: Database, count: data.assets.length },
    { id: 'applications', label: 'Deliverables', icon: Box, count: (data.applications || []).length },
    { id: 'assetCategories', label: 'Categories', icon: FolderTree, count: data.assetCategories.length },
    { id: 'programmes', label: 'Programmes', icon: Calendar, count: data.programmes.length },
    { id: 'strategies', label: 'Strategies', icon: Target, count: data.strategies.length },
    { id: 'milestones', label: 'Milestones', icon: Flag, count: data.milestones.length },
    { id: 'resources', label: 'Resources', icon: Users, count: (data.resources || []).length },
    { id: 'appStatuses', label: 'App Statuses', icon: Layers, count: (data.applicationStatuses || []).length },
    { id: 'rpti', label: 'RPTI', icon: ClipboardList, count: (data.rptiDetails || []).length },
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
        {activeTab === 'applications' && (
          <EditableTable
            data={data.applications || []}
            columns={getColumnsWithWidths('applications', applicationColumns)}
            onUpdate={(newData) => updateData('applications', newData)}
            onDelete={handleDeleteApplication}
            onClearAll={handleClearApplications}
            idField="id"
            searchQuery={searchQuery}
            tableId="applications"
            onColumnResize={(key, width) => handleColumnResize('applications', key, width)}
          />
        )}
        {activeTab === 'appStatuses' && (
          <EditableTable
            data={data.applicationStatuses || []}
            columns={getColumnsWithWidths('appStatuses', appStatusColumns)}
            onUpdate={(newData) => updateData('applicationStatuses', newData)}
            onDelete={(status) => { updateData('applicationStatuses', (data.applicationStatuses || []).filter(s => s.id !== status.id)); return true; }}
            idField="id"
            tableId="appStatuses"
            onColumnResize={(col, w) => handleColumnResize('appStatuses', col, w)}
          />
        )}
        {activeTab === 'rpti' && (
          <EditableTable
            data={data.rptiDetails || []}
            columns={getColumnsWithWidths('rpti', rptiColumns)}
            onUpdate={(newData) => updateData('rptiDetails', deriveRptiTargetTypes(newData))}
            onDelete={(row) => { updateData('rptiDetails', (data.rptiDetails || []).filter(r => r.id !== row.id)); return true; }}
            idField="id"
            tableId="rpti"
            onColumnResize={(col, w) => handleColumnResize('rpti', col, w)}
          />
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
