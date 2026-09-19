import React, { useState } from 'react';
import { decisionsStrandedBy, LinkedEntityRef } from '../lib/decisionLinks';
import { Asset, Deliverable, DeliverableSegment, DeliverableStatus, DeliverableType, Decision, RptiDetail, LkptiDetail, Initiative, Milestone, Programme, Strategy, Dependency, AssetCategory, TimelineSettings, Resource } from '../types';
import { EditableTable, Column } from './EditableTable';
import { cn } from '../lib/utils';
import { Database, Layers, Calendar, Flag, Target, Link2, FolderTree, LayoutTemplate, Users, Box, ClipboardList, ListChecks, Filter, X } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';
import { clearDeliverablesAndSegments, removeDeliverableAndSegments } from '../lib/deliverableCascade';
import { rptiCascadeOnInitiativeDelete, rptiCascadeOnDeliverableDelete, rptiCascadeOnAssetDelete, RPTI_CATEGORY_LABELS } from '../lib/rpti';
import { lkptiCascadeOnDeliverableDelete } from '../lib/lkpti';
import { DataManagerTab } from '../lib/dataHealth';

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
  onClearSearch: () => void;
  // Set by a caller that wants to land on a specific tab on mount (e.g. the Data
  // Completeness report's "jump to this record" links) — read once, not controlled,
  // since DataManager unmounts/remounts whenever `view` in App.tsx leaves and returns
  // to 'data'.
  initialTab?: DataManagerTab;
}

type Tab = DataManagerTab;

function ReadonlyReportRows({ testId, rows, initiatives, deliverables, assets, searchQuery }: {
  testId: string;
  rows: Array<Record<string, unknown>>;
  initiatives: Initiative[];
  deliverables: Deliverable[];
  assets: Asset[];
  searchQuery?: string;
}) {
  const labels: Record<string, string> = {
    categoryCode: 'Category', developmentType: 'Dev Type', developer: 'Developer',
    ppjtiRelatedParty: 'Related Party', plannedImplementationQuarter: 'Quarter',
    dcCity: 'DC City', dcCountry: 'DC Country', drCity: 'DR City', drCountry: 'DR Country',
    remarks: 'Remarks', functionDescription: 'Function Description', platform: 'Platform',
    database: 'Database', dcProvider: 'DC Provider', drcProvider: 'DRC Provider',
    backupStrategy: 'Backup Strategy', systemOwner: 'System Owner', goLiveDate: 'Go-Live Date', ownership: 'Ownership',
  };
  // Keep every stored value visible, including fields only an unresolved import owns.
  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))].filter(key =>
    !['id', 'targetId', 'targetType', 'initiativeId', 'deliverableSegmentId'].includes(key));
  const normalizedSearch = searchQuery?.trim().toLowerCase();
  const visibleRows = normalizedSearch
    ? rows.filter(row => {
      const targetName = deliverables.find(item => item.id === row.targetId)?.name
        ?? assets.find(item => item.id === row.targetId)?.name;
      const initiativeName = initiatives.find(item => item.id === row.initiativeId)?.name;
      return [...Object.values(row), targetName, initiativeName].some(value => {
        if (value === null || value === undefined) return false;
        const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
        return text.toLowerCase().includes(normalizedSearch);
      });
    })
    : rows;
  return (
    <div data-testid={testId} className="overflow-auto rounded-lg border border-slate-200 bg-white">
      {visibleRows.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">
          {normalizedSearch && rows.length > 0
            ? 'No report rows match the global search.'
            : 'No stored rows. Generate a filing from Reports.'}
        </p>
      ) : (
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Target</th><th className="px-3 py-2">Initiative</th>{columns.map(key => <th key={key} className="px-3 py-2">{labels[key] ?? key}</th>)}</tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => (
              <tr key={String(row.id ?? index)} className="border-t border-slate-100">
                <td className="px-3 py-2">{index + 1}</td>
                <td className="px-3 py-2">{deliverables.find(item => item.id === row.targetId)?.name ?? assets.find(item => item.id === row.targetId)?.name ?? 'Missing target'}</td>
                <td className="px-3 py-2">{initiatives.find(item => item.id === row.initiativeId)?.name ?? '—'}</td>
                {columns.map(key => <td key={key} className="px-3 py-2 text-slate-600 whitespace-pre-wrap">{row[key] == null ? '—' : typeof row[key] === 'object' ? JSON.stringify(row[key]) : String(row[key])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function DataManager({ data, onUpdate, onOpenTemplatePicker, searchQuery, onClearSearch, initialTab }: DataManagerProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? 'initiatives');
  const [pendingConfirm, setPendingConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const activeSearchQuery = searchQuery?.trim() ?? '';

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
    customMsg?: string,
    strandedDecisions = 0
  ): boolean => {
    const buildMsg = () => {
      const sentences = [cascadeParts.length
        ? `Deleting "${entityName}" will also remove ${cascadeParts.join(', ')}.`
        : `Delete "${entityName}"?`];
      if (strandedDecisions) {
        // Deliberately phrased apart from cascadeParts: decisions are never removed
        // by a cascade (ADR-0011) — the log outlives what it describes. What breaks
        // is the reference, so the warning says the link is lost, not the record.
        sentences.push(`${strandedDecisions} decision(s) will keep their record but lose their link to it.`);
      }
      if (cascadeParts.length) sentences.push('Continue?');
      return sentences.join(' ');
    };
    confirm(title, customMsg ?? buildMsg(), () => onUpdate({ ...data, ...updates }));
    return true;
  };

  /** How many decisions would lose their subject if these entities were deleted. */
  const strandedBy = (removed: LinkedEntityRef[]) => decisionsStrandedBy(data.decisions, removed).length;

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
    const stranded = strandedBy([
      { type: 'asset', id: asset.id },
      ...affectedInits.map(i => ({ type: 'initiative' as const, id: i.id })),
    ]);
    return cascadeDelete('Delete Asset', asset.name, parts, {
      assets: data.assets.filter(a => a.id !== asset.id),
      initiatives: data.initiatives.filter(i => i.assetId !== asset.id),
      milestones: data.milestones.filter(m => m.assetId !== asset.id),
      dependencies: data.dependencies.filter(d => !affectedInitIds.has(d.sourceId) && !affectedInitIds.has(d.targetId)),
      rptiDetails: rptiCascadeOnAssetDelete(
        data.rptiDetails.filter(r => !affectedInitIds.has(r.initiativeId)),
        asset.id
      ),
    }, undefined, stranded);
  };

  const handleDeleteProgramme = (prog: Programme): boolean => {
    const affectedInits = data.initiatives.filter(i => i.programmeId === prog.id);
    const affectedInitIds = new Set(affectedInits.map(i => i.id));
    const affectedDeps = data.dependencies.filter(d => affectedInitIds.has(d.sourceId) || affectedInitIds.has(d.targetId));
    const parts = [];
    if (affectedInits.length) parts.push(`${affectedInits.length} initiative(s)`);
    if (affectedDeps.length) parts.push(`${affectedDeps.length} dependency(ies)`);
    const stranded = strandedBy([
      { type: 'programme', id: prog.id },
      ...affectedInits.map(i => ({ type: 'initiative' as const, id: i.id })),
    ]);
    return cascadeDelete('Delete Programme', prog.name, parts, {
      programmes: data.programmes.filter(p => p.id !== prog.id),
      initiatives: data.initiatives.filter(i => i.programmeId !== prog.id),
      dependencies: data.dependencies.filter(d => !affectedInitIds.has(d.sourceId) && !affectedInitIds.has(d.targetId)),
    }, undefined, stranded);
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
    const stranded = strandedBy([{ type: 'initiative', id: init.id }]);
    return cascadeDelete('Delete Initiative', init.name, parts, {
      initiatives: data.initiatives.filter(i => i.id !== init.id),
      dependencies: data.dependencies.filter(d => d.sourceId !== init.id && d.targetId !== init.id),
      rptiDetails: rptiCascadeOnInitiativeDelete(data.rptiDetails, init.id),
    }, undefined, stranded);
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
    const stranded = strandedBy([
      ...affectedAssets.map(a => ({ type: 'asset' as const, id: a.id })),
      ...affectedInits.map(i => ({ type: 'initiative' as const, id: i.id })),
    ]);
    return cascadeDelete('Delete Category', cat.name, parts, {
      assetCategories: data.assetCategories.filter(c => c.id !== cat.id),
      assets: data.assets.filter(a => a.categoryId !== cat.id),
      initiatives: data.initiatives.filter(i => !affectedAssetIds.has(i.assetId)),
      milestones: data.milestones.filter(m => !affectedAssetIds.has(m.assetId)),
      dependencies: data.dependencies.filter(d => !affectedInitIds.has(d.sourceId) && !affectedInitIds.has(d.targetId)),
    }, undefined, stranded);
  };

  const assetOptions = data.assets.map(a => ({ value: a.id, label: a.name }));
  const programmeOptions = data.programmes.map(p => ({ value: p.id, label: p.name }));
  const strategyOptions = data.strategies.map(s => ({ value: s.id, label: s.name }));
  const initiativeOptions = data.initiatives.map(i => ({ value: i.id, label: i.name }));
  const categoryOptions = data.assetCategories.map(c => ({ value: c.id, label: c.name }));

  const initiativeColumns: Column<Initiative>[] = [
    { key: 'name', label: 'Initiative Name', type: 'text', width: '280px' },
    { key: 'assetId', label: 'Asset', type: 'select', options: assetOptions, width: '230px' },
    { key: 'deliverableId', label: 'Deliverable', type: 'select', options: [{ value: '', label: '— Infer from lifecycle segments —' }, ...data.deliverables.map(deliverable => ({ value: deliverable.id, label: deliverable.name }))], width: '230px' },
    { key: 'programmeId', label: 'Programme', type: 'select', options: programmeOptions, width: '150px' },
    { key: 'strategyId', label: 'Strategy', type: 'select', options: strategyOptions, width: '150px' },
    { key: 'startDate', label: 'Start Date', type: 'date', width: '130px' },
    { key: 'endDate', label: 'End Date', type: 'date', width: '130px' },
    { key: 'capex', label: `CapEx (${data.timelineSettings.defaultCurrency || 'USD'})`, type: 'number', width: '120px' },
    { key: 'opex', label: `OpEx (${data.timelineSettings.defaultCurrency || 'USD'})`, type: 'number', width: '120px' },
    { key: 'status', label: 'Status', type: 'select', options: [
      { value: 'planned', label: 'Planned' },
      { value: 'active', label: 'Active' },
      { value: 'done', label: 'Done' },
      { value: 'cancelled', label: 'Cancelled' },
    ], width: '140px' },
    { key: 'ragStatus', label: 'RAG Status', type: 'select', options: [
      { value: '', label: '— None —' },
      { value: 'green', label: 'Green' },
      { value: 'amber', label: 'Amber' },
      { value: 'red', label: 'Red' },
    ], width: '100px' },
    { key: 'progress', label: 'Progress (%)', type: 'number', width: '90px' },
    { key: 'owner', label: 'Owner', type: 'text', width: '150px' },
    { key: 'isPlaceholder', label: 'Placeholder?', type: 'boolean', width: '80px' },
    { key: 'description', label: 'Description', type: 'textarea', width: '260px', placeholder: 'Add a description...' },
    // The RPTI's two free-text columns are both owned here (ADR-0013): Deskripsi from
    // `description` above, Keterangan from this. Labelled by what it feeds, because
    // "Description" and "Remarks" alone would not tell anyone which column is which.
    { key: 'rptiRemarks', label: 'RPTI Remarks (Keterangan)', type: 'textarea', width: '260px', placeholder: 'Noted about this work in the plan…' },
  ];

  const assetColumns: Column<Asset>[] = [
    { key: 'name', label: 'Asset Name', type: 'text', width: '220px' },
    { key: 'categoryId', label: 'Category', type: 'select', options: categoryOptions, width: '160px' },
    { key: 'maturity', label: 'Maturity', type: 'select', options: [
      { value: '', label: '— Unrated —' },
      { value: '1', label: '1 – Emergent' },
      { value: '2', label: '2 – Developing' },
      { value: '3', label: '3 – Defined' },
      { value: '4', label: '4 – Managed' },
      { value: '5', label: '5 – Optimised' },
    ], width: '110px' },
  ];

  const categoryColumns: Column<AssetCategory>[] = [
    { key: 'name', label: 'Category Name', type: 'text', width: '340px' },
    { key: 'order', label: 'Sort Order', type: 'number', width: '100px' },
    {
      key: 'categoryCode', label: 'Default Category Code', type: 'select', width: '200px',
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
    { key: 'name', label: 'Programme Name', type: 'text', width: '220px' },
    { key: 'color', label: 'Color', type: 'color', width: '120px' },
  ];

  const strategyColumns: Column<Strategy>[] = [
    { key: 'name', label: 'Strategy Name', type: 'text', width: '220px' },
    { key: 'color', label: 'Color', type: 'color', width: '120px' },
  ];

  const milestoneColumns: Column<Milestone>[] = [
    { key: 'name', label: 'Milestone Name', type: 'text', width: '220px' },
    { key: 'assetId', label: 'Asset', type: 'select', options: assetOptions, width: '230px' },
    { key: 'date', label: 'Date', type: 'date', width: '130px' },
    {
      key: 'type', label: 'Type', type: 'select', options: [
        { value: 'info', label: 'Info' },
        { value: 'warning', label: 'Warning' },
        { value: 'critical', label: 'Critical' }
      ], width: '130px'
    },
  ];

  const dependencyColumns: Column<Dependency>[] = [
    { key: 'sourceId', label: 'Dependent Initiative', type: 'select', options: initiativeOptions, width: '35%' },
    { key: 'targetId', label: 'Depends On', type: 'select', options: initiativeOptions, width: '230px' },
    {
      key: 'type', label: 'Dependency Type', type: 'select', options: [
        { value: 'blocks', label: 'Blocks' },
        { value: 'requires', label: 'Requires' },
        { value: 'related', label: 'Related' }
      ], width: '130px'
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
    { key: 'name', label: 'Name', type: 'text', width: '220px' },
    { key: 'role', label: 'Role', type: 'text', width: '150px' },
  ];

  const deliverableColumns: Column<Deliverable>[] = [
    { key: 'name', label: 'Name', type: 'text', width: '280px' },
    {
      key: 'type', label: 'Type', type: 'select', width: '130px',
      options: (['application', 'infrastructure', 'document', 'procedure', 'other'] as DeliverableType[])
        .map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) })),
    },
    {
      key: 'assetId', label: 'Asset', type: 'select', width: '230px',
      options: data.assets.map(a => ({ value: a.id, label: a.name })),
    },
    { key: 'description', label: 'Description', type: 'textarea', width: '260px' },
    {
      key: 'categoryCode', label: 'Category Code Override', type: 'select', width: '200px',
      options: [
        { value: '', label: '— Use category default —' },
        ...(Object.keys(RPTI_CATEGORY_LABELS) as (keyof typeof RPTI_CATEGORY_LABELS)[])
          .map(code => ({ value: code, label: `${code} — ${RPTI_CATEGORY_LABELS[code]}` })),
      ],
    },
    // Free text, not a two-value select: ADR-0013 widened this to carry a service
    // provider's *name*, which is what LKPTI files. RPTI derives its own classification
    // from it — anything that is not 'inhouse' is PPJTI — so one field serves both
    // returns and the name is never lost.
    { key: 'developer', label: 'Developer', type: 'text', width: '200px', placeholder: "'inhouse' or provider name" },
    {
      key: 'ppjtiRelatedParty', label: 'Provider Related Party', type: 'select', width: '150px',
      options: [
        { value: '', label: '— Not set —' },
        { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'n/a', label: 'N/A' },
      ],
    },
    { key: 'dcCity', label: 'DC City Override', type: 'text', width: '130px' },
    { key: 'dcCountry', label: 'DC Country Override', type: 'text', width: '130px' },
    { key: 'drCity', label: 'DR City Override', type: 'text', width: '130px' },
    { key: 'drCountry', label: 'DR Country Override', type: 'text', width: '130px' },
    // The seven LKPTI attributes ADR-0013 moved off the report row onto the application
    // they describe. This is the only place they are now editable, and the data-health
    // findings for them point here (FR-021a).
    { key: 'platform', label: 'Platform', type: 'text', width: '180px' },
    { key: 'database', label: 'Database', type: 'text', width: '150px' },
    { key: 'dcProvider', label: 'DC Provider', type: 'text', width: '150px', placeholder: "'self' or company name" },
    { key: 'drcProvider', label: 'DRC Provider', type: 'text', width: '150px', placeholder: "'self' or company name" },
    {
      key: 'backupStrategy', label: 'Backup Strategy', type: 'select', width: '190px',
      options: [
        { value: '', label: '— Not set —' },
        { value: 'HA_ACTIVE_ACTIVE', label: 'HA Active-Active' },
        { value: 'HA_ACTIVE_PASSIVE', label: 'HA Active-Passive' },
        { value: 'BACKUP_REALTIME', label: 'Backup Realtime' },
        { value: 'BACKUP_PERIODIC', label: 'Backup Periodic' },
      ],
    },
    { key: 'systemOwner', label: 'System Owner', type: 'text', width: '230px' },
    {
      key: 'ownership', label: 'Ownership', type: 'select', width: '140px',
      options: [
        { value: '', label: '— Not set —' },
        { value: 'LEASE', label: 'Lease' },
        { value: 'OUTRIGHT_PURCHASE', label: 'Outright Purchase' },
      ],
    },
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
    { key: 'name', label: 'Status Name', type: 'text', width: '220px' },
    { key: 'color', label: 'Color', type: 'color', width: '120px' },
    { key: 'isLiveStatus', label: 'Live?', type: 'boolean', width: '20%' },
    { key: 'isPreLaunchStatus', label: 'Pre-Launch?', type: 'boolean', width: '20%' },
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

      {activeSearchQuery && (
        <div
          data-testid="data-manager-filter-indicator"
          className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800"
        >
          <Filter size={15} aria-hidden="true" />
          <span className="flex-1">
            Filtered by <strong className="font-semibold">“{activeSearchQuery}”</strong>
          </span>
          <button
            type="button"
            onClick={onClearSearch}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <X size={14} aria-hidden="true" />
            Clear global search
          </button>
        </div>
      )}

      <div className="flex-1 p-6 overflow-hidden">
        {activeTab === 'initiatives' && (
          <EditableTable
            data={data.initiatives}
            columns={getColumnsWithWidths('initiatives', initiativeColumns)}
            onUpdate={(newData) => updateData('initiatives', newData)}
            onDelete={handleDeleteInitiative}
            idField="id"
            searchQuery={activeSearchQuery}
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
            searchQuery={activeSearchQuery}
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
            searchQuery={activeSearchQuery}
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
            searchQuery={activeSearchQuery}
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
            searchQuery={activeSearchQuery}
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
            searchQuery={activeSearchQuery}
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
            searchQuery={activeSearchQuery}
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
            searchQuery={activeSearchQuery}
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
            searchQuery={activeSearchQuery}
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
            searchQuery={activeSearchQuery}
            tableId="deliverableStatuses"
            onColumnResize={(col, w) => handleColumnResize('deliverableStatuses', col, w)}
          />
        )}
        {activeTab === 'rpti' && (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs text-slate-500">
                Stored RPTI rows are read-only. Choose a year and generate the filing from Reports.
              </p>
            </div>
            <ReadonlyReportRows testId="rpti-readonly-table" rows={data.rptiDetails as unknown as Array<Record<string, unknown>>} initiatives={data.initiatives} deliverables={data.deliverables} assets={data.assets} searchQuery={activeSearchQuery} />
          </div>
        )}
        {activeTab === 'lkpti' && (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs text-slate-500">
                Stored LKPTI rows are read-only. Choose an as-at year and generate the filing from Reports.
              </p>
            </div>
            <ReadonlyReportRows testId="lkpti-readonly-table" rows={data.lkptiDetails as unknown as Array<Record<string, unknown>>} initiatives={data.initiatives} deliverables={data.deliverables} assets={data.assets} searchQuery={activeSearchQuery} />
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
