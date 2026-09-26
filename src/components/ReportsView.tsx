import React, { useState, useEffect } from 'react';
import { Asset, Initiative, Dependency, Milestone, Version, Programme, Strategy, AssetCategory, Resource, Deliverable, DeliverableSegment, DeliverableStatus, RptiDetail, LkptiDetail } from '../types';
import { getAllVersions } from '../lib/db';
import { computeDiff, DiffResult } from '../lib/diff';
import { DiffSections } from './DiffSection';
import { HealthIssueLocation } from '../lib/dataHealth';
import { History, DollarSign, GitBranch, Users, ChevronLeft, Grid, ClipboardList, ListChecks, HeartPulse } from 'lucide-react';
import { MaturityHeatmap } from './MaturityHeatmap';
import { AssetPanel } from './AssetPanel';
import { RptiReportView } from './RptiReportView';
import { LkptiReportView } from './LkptiReportView';
import { DataHealthReportView } from './DataHealthReportView';
import { projectRptiReturn, reconcileRptiReturn } from '../lib/rpti';
import { generateLkptiDetails } from '../lib/lkpti';
import { computeDataHealth } from '../lib/dataHealth';
import { isRepairableUnresolvedRow, type UnresolvedRowRepairRequest, type UnresolvedRowRepairState } from '../lib/unresolvedRowRepair';
import { UnresolvedRowRepairDialog } from './UnresolvedRowRepairDialog';

interface ReportsViewProps {
  assets: Asset[];
  initiatives: Initiative[];
  milestones: Milestone[];
  dependencies: Dependency[];
  currentData: Version['data'];
  programmes: Programme[];
  strategies: Strategy[];
  assetCategories: AssetCategory[];
  resources?: Resource[];
  deliverables?: Deliverable[];
  deliverableSegments?: DeliverableSegment[];
  deliverableStatuses?: DeliverableStatus[];
  rptiDetails?: RptiDetail[];
  lkptiDetails?: LkptiDetail[];
  onSaveAsset?: (asset: Asset) => void;
  onNavigate?: (location: HealthIssueLocation, entityName: string) => void;
  onRepairUnresolvedRow?: (request: UnresolvedRowRepairRequest) => Promise<{ ok: true; state: UnresolvedRowRepairState } | { ok: false; reason: string }>;
  onExtendImportPriorPhase?: (segmentId: string) => void;
  /**
   * Open directly on a given report instead of the card grid. Needed because
   * `selectedReport` is local state with no other way in, and onboarding has to
   * land the user on the data-health review once an import completes.
   * Applied at mount only, so navigating away and back still returns to the grid.
   */
  initialReport?: ReportSlug;
}

type ReportSlug = 'version-history' | 'budget' | 'initiatives-dependencies' | 'capacity' | 'maturity-heatmap' | 'rpti' | 'lkpti' | 'data-health';


function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      data-testid="report-back-btn"
      onClick={onBack}
      className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-4"
    >
      <ChevronLeft size={16} />
      All Reports
    </button>
  );
}

const fmt = (n: number, currency: string) =>
  n >= 1_000_000 ? `${currency} ${(n / 1_000_000).toFixed(1)}m` : n >= 1_000 ? `${currency} ${Math.round(n / 1_000)}k` : `${currency} ${n.toLocaleString()}`;

function BudgetBar({ total, max, color }: { total: number; max: number; color?: string }) {
  return (
    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color ?? 'bg-blue-500'}`} style={{ width: `${max > 0 ? Math.round((total / max) * 100) : 0}%` }} />
    </div>
  );
}

function BudgetSection({ testId, title, rows, max, currency }: { testId: string; title: string; rows: { id: string; name: string; capex: number; opex: number; total: number; color?: string }[]; max: number; currency: string }) {
  return (
    <div data-testid={testId} className="space-y-2">
      <div className="flex items-center gap-3">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider w-44 flex-shrink-0">{title}</h3>
        <div className="flex-1" />
        <span className="text-xs font-semibold text-blue-500 w-16 text-right flex-shrink-0">CapEx</span>
        <span className="text-xs font-semibold text-amber-500 w-16 text-right flex-shrink-0">OpEx</span>
        <span className="text-xs font-semibold text-slate-500 w-16 text-right flex-shrink-0">Total</span>
      </div>
      {rows.map(row => (
        <div key={row.id} data-testid={`budget-row-${testId.replace('budget-by-', '')}-${row.id}`} className="flex items-center gap-3">
          <span className="text-sm text-slate-700 w-44 truncate flex-shrink-0">{row.name}</span>
          <BudgetBar total={row.total} max={max} color={row.color} />
          <span data-testid="row-capex" className="text-xs text-blue-600 w-16 text-right flex-shrink-0">{fmt(row.capex, currency)}</span>
          <span data-testid="row-opex" className="text-xs text-amber-600 w-16 text-right flex-shrink-0">{fmt(row.opex, currency)}</span>
          <span data-testid="row-total" className="text-sm font-semibold text-slate-800 w-16 text-right flex-shrink-0">{fmt(row.total, currency)}</span>
        </div>
      ))}
    </div>
  );
}

function depSentence(dep: Dependency, src: Initiative, tgt: Initiative, perspectiveId: string): string {
  const isSource = src.id === perspectiveId;
  if (dep.type === 'blocks') {
    if (isSource) return `Blocking: ${src.name} must finish before ${tgt.name} can start.`;
    return `Blocked: ${tgt.name} can't start until ${src.name} has finished.`;
  }
  if (dep.type === 'requires') {
    if (isSource) return `Required: ${src.name} requires ${tgt.name} to start first.`;
    return `Required by: ${tgt.name} must start first before ${src.name}.`;
  }
  return `${src.name} and ${tgt.name} are related.`;
}

export function ReportsView({ assets, initiatives, milestones, dependencies, currentData, programmes, strategies, assetCategories, resources = [], deliverables = [], deliverableSegments = [], deliverableStatuses = [], rptiDetails = [], lkptiDetails = [], onSaveAsset, onNavigate, onRepairUnresolvedRow, onExtendImportPriorPhase, initialReport }: ReportsViewProps) {
  const [selectedReport, setSelectedReport] = useState<ReportSlug | null>(initialReport ?? null);
  // Offered, not assumed: the year the preparer stated at onboarding pre-fills the box
  // they still have to see and confirm (FR-009, contract 1). An empty default is correct
  // when nothing was stated — the one thing that must never fill it is the clock.
  const [rptiYearInput, setRptiYearInput] = useState(
    currentData.timelineSettings.onboardingRptiYear ? String(currentData.timelineSettings.onboardingRptiYear) : '');
  const [lkptiYearInput, setLkptiYearInput] = useState(
    currentData.timelineSettings.onboardingLkptiYear ? String(currentData.timelineSettings.onboardingLkptiYear) : '');
  const [generatedRptiDetails, setGeneratedRptiDetails] = useState<RptiDetail[] | null>(null);
  const [generatedLkptiDetails, setGeneratedLkptiDetails] = useState<LkptiDetail[] | null>(null);
  const [repairRowId, setRepairRowId] = useState<string | null>(null);
  /*
   * One piece of state, not two. The panel is open precisely when its asset still
   * exists, so deriving that from `assets` rather than mirroring it into a second
   * useState makes the dangling case impossible by construction — an asset deleted
   * here, or by another tab via cross-tab sync (requirement-specs/cross-tab-sync.md),
   * closes the panel on the same render. This previously took an effect that called
   * setState synchronously, costing a second cascading render to fix up state that
   * should never have diverged.
   */
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const selectedAsset = selectedAssetId ? assets.find(a => a.id === selectedAssetId) ?? null : null;
  const assetPanelOpen = selectedAsset !== null;
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [versionsError, setVersionsError] = useState<string | null>(() =>
    typeof localStorage !== 'undefined' && localStorage.getItem('scenia-test-versions-fail') === 'true'
      ? 'Failed to load saved versions. Please try reloading.'
      : null
  );

  useEffect(() => {
    if (versionsError) return;
    getAllVersions().then(loaded => {
      const sorted = loaded.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      setVersions(sorted);
    }).catch(() => {
      setVersionsError('Failed to load saved versions. Please try reloading.');
    });
  }, [versionsError]);

  const handleRunDiff = () => {
    const base = versions.find(v => v.id === selectedVersionId);
    if (!base) return;
    setDiffResult(computeDiff(base, currentData));
  };

  const reportYear = (value: string): number | undefined => {
    const parsed = Number(value);
    return /^\d{4}$/.test(value) && Number.isInteger(parsed) ? parsed : undefined;
  };
  const rptiYear = reportYear(rptiYearInput);
  const lkptiYear = reportYear(lkptiYearInput);

  const generateRptiReport = () => {
    if (!rptiYear) return;
    // Pure selected-year projection (issue #40, contract 2): the input type cannot
    // carry the stored rows, so nothing filed can join the return silently.
    setGeneratedRptiDetails(projectRptiReturn({
      deliverableSegments, deliverableStatuses, initiatives, deliverables, assets, assetCategories,
    }, rptiYear));
  };
  const generateLkptiReport = () => {
    if (!lkptiYear) return;
    setGeneratedLkptiDetails(generateLkptiDetails({
      asAtDate: `${lkptiYear}-12-31`, deliverableSegments, deliverableStatuses, deliverables,
      assets, assetCategories, existingDetails: lkptiDetails,
    }));
  };
  // Pre-export gate = source diagnostics + reconciliation of the stored rows against
  // the source model (option 1). The projection itself is never the evidence: stored
  // rows may block an export by being unreproducible, but they enter the return only
  // as projections of the canonical entities (requirement-specs/report-rows-as-projections.md Q11).
  const rptiReconciliationFindings = generatedRptiDetails
    ? reconcileRptiReturn({
        storedDetails: rptiDetails, initiatives, deliverables,
        deliverableSegments, deliverableStatuses,
      })
    : [];
  const rptiPreExportIssues = generatedRptiDetails
    ? [
        ...computeDataHealth({
          assets, assetCategories, deliverables, deliverableSegments, deliverableStatuses,
          initiatives, milestones, dependencies, decisions: currentData.decisions ?? [], resources,
          // Deliberately empty, not the projection. Data Health treats whatever it
          // is handed here as *stored evidence* and reconciles it against canonical
          // identities that are still (initiative, target) — so two implementation
          // rows on one application would collide as an identity-conflict and block
          // the export this feature exists to enable. Stored rows still reach the
          // gate, through rptiReconciliationFindings below; what remains of this
          // call is the source-side `initiative-rpti-*` diagnostics.
          programmes, strategies, rptiDetails: [], lkptiDetails,
          timelineSettings: currentData.timelineSettings,
        }).filter(issue => issue.severity === 'error' && (issue.entityType === 'RptiDetail' || issue.id.startsWith('initiative-rpti-'))).map(issue => ({ message: issue.message })),
        ...rptiReconciliationFindings.map(finding => ({ message: finding.message,
          ...(finding.reason === 'missing-target' && rptiDetails.some(row => row.id === finding.rowId && isRepairableUnresolvedRow(row))
            ? { rowId: finding.rowId } : {}) })),
      ]
    : [];

  const repairRow = rptiDetails.find(row => row.id === repairRowId && isRepairableUnresolvedRow(row));
  const repairDialog = repairRow && onRepairUnresolvedRow && initiatives.some(item => item.id === repairRow.initiativeId) ? (
    <UnresolvedRowRepairDialog key={repairRow.id} row={repairRow} initiatives={initiatives}
      assets={assets} assetCategories={assetCategories} deliverables={deliverables}
      deliverableSegments={deliverableSegments} deliverableStatuses={deliverableStatuses}
      onCancel={() => setRepairRowId(null)}
      onConfirm={async request => {
        const result = await onRepairUnresolvedRow(request);
        if (result.ok) {
          if (generatedRptiDetails && rptiYear) setGeneratedRptiDetails(projectRptiReturn(result.state, rptiYear));
          setRepairRowId(null);
        }
        return result;
      }} />
  ) : null;

  const cards: { slug: ReportSlug; icon: React.ReactNode; title: string; description: string }[] = [
    {
      slug: 'version-history',
      icon: <History size={28} className="text-indigo-500" />,
      title: 'Version History',
      description: 'Compare the current plan against a saved version to see what has changed.',
    },
    {
      slug: 'budget',
      icon: <DollarSign size={28} className="text-emerald-500" />,
      title: 'Budget Report',
      description: 'See total spend broken down by programme, strategy, and category.',
    },
    {
      slug: 'initiatives-dependencies',
      icon: <GitBranch size={28} className="text-blue-500" />,
      title: 'Initiatives & Dependencies',
      description: 'Review every initiative and its upstream or downstream dependencies.',
    },
    {
      slug: 'capacity',
      icon: <Users size={28} className="text-amber-500" />,
      title: 'Capacity & Resources',
      description: 'See how many initiatives each resource is assigned to across the portfolio.',
    },
    {
      slug: 'maturity-heatmap',
      icon: <Grid size={28} className="text-rose-500" />,
      title: 'Maturity Heatmap',
      description: 'View all IT assets arranged by capability group and coloured by their maturity level.',
    },
    {
      slug: 'rpti',
      icon: <ClipboardList size={28} className="text-teal-500" />,
      title: 'RPTI Report',
      description: 'Indonesian OJK IT Development Plan Report (Format 3.1) — track planned application and infrastructure development.',
    },
    {
      slug: 'lkpti',
      icon: <ListChecks size={28} className="text-fuchsia-500" />,
      // LKPTI has many appendix reports; this card is only the Application List (3.2.6).
      title: 'LKPTI - Application List Report',
      description: 'Indonesian OJK LKPTI Application List (Format 3.2.6) — an inventory of currently live applications.',
    },
    {
      slug: 'data-health',
      icon: <HeartPulse size={28} className="text-red-500" />,
      title: 'Data Health',
      description: 'Dangling references, report-generation gaps, and values that would be rejected at filing time.',
    },
  ];

  // ── Home screen ──────────────────────────────────────────────────────────────
  if (selectedReport === null) {
    return (
      <div data-testid="reports-view" className="h-full overflow-y-auto p-6 bg-slate-50">
        <div data-testid="reports-home" className="max-w-3xl mx-auto">
          <h1 className="text-xl font-bold text-slate-800 mb-6">Reports</h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {cards.map(({ slug, icon, title, description }) => (
              <button
                key={slug}
                data-testid={`report-card-${slug}`}
                onClick={() => setSelectedReport(slug)}
                className="text-left bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:border-blue-300 hover:shadow-md transition-all group"
              >
                <div className="mb-3">{icon}</div>
                <h2 className="text-base font-semibold text-slate-800 mb-1 group-hover:text-blue-700">{title}</h2>
                <p className="text-sm text-slate-500">{description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Version History ──────────────────────────────────────────────────────────
  if (selectedReport === 'version-history') {
    return (
      <div data-testid="report-view-version-history" className="h-full overflow-y-auto p-6 bg-slate-50">
        <div className="max-w-3xl mx-auto">
          <BackButton onBack={() => setSelectedReport(null)} />
          <div data-testid="report-history-diff" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-800">History Differences</h2>
            </div>
            <div className="p-4">
              {versionsError ? (
                <p data-testid="versions-load-error" className="text-sm text-red-500">{versionsError}</p>
              ) : versions.length === 0 ? (
                <p className="text-sm text-slate-400">No saved versions</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <select
                      data-testid="version-select"
                      value={selectedVersionId}
                      onChange={e => { setSelectedVersionId(e.target.value); setDiffResult(null); }}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select a version…</option>
                      {versions.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleRunDiff}
                      disabled={!selectedVersionId}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-40"
                    >
                      Run Difference Report
                    </button>
                  </div>

                  {diffResult && (
                    <div data-testid="diff-result" className="mt-4 space-y-4">
                      {!diffResult.hasChanges ? (
                        <p className="text-sm text-slate-500 text-center py-4">No changes detected — this version matches the current state.</p>
                      ) : (
                        <DiffSections diff={diffResult} />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Budget Report ────────────────────────────────────────────────────────────
  if (selectedReport === 'budget') {
    const realInitiatives = initiatives.filter(i => !i.isPlaceholder);
    const capexOf = (inits: typeof realInitiatives) => inits.reduce((sum, i) => sum + (i.capex || 0), 0);
    const opexOf  = (inits: typeof realInitiatives) => inits.reduce((sum, i) => sum + (i.opex  || 0), 0);
    const totalOf = (inits: typeof realInitiatives) => capexOf(inits) + opexOf(inits);
    const grandCapex = capexOf(realInitiatives);
    const grandOpex  = opexOf(realInitiatives);
    const grandTotal = grandCapex + grandOpex;

    const byProgramme = programmes
      .map(p => {
        const inits = realInitiatives.filter(i => i.programmeId === p.id);
        return { id: p.id, name: p.name, color: p.color, capex: capexOf(inits), opex: opexOf(inits), total: totalOf(inits) };
      })
      .filter(r => r.total > 0).sort((a, b) => b.total - a.total);

    const byStrategy = strategies
      .map(s => {
        const inits = realInitiatives.filter(i => i.strategyId === s.id);
        return { id: s.id, name: s.name, color: s.color, capex: capexOf(inits), opex: opexOf(inits), total: totalOf(inits) };
      })
      .filter(r => r.total > 0).sort((a, b) => b.total - a.total);

    const byCategory = assetCategories
      .map(c => {
        const catAssets = assets.filter(a => a.categoryId === c.id).map(a => a.id);
        const inits = realInitiatives.filter(i => catAssets.includes(i.assetId));
        return { id: c.id, name: c.name, capex: capexOf(inits), opex: opexOf(inits), total: totalOf(inits) };
      })
      .filter(r => r.total > 0).sort((a, b) => b.total - a.total);

    const currency = currentData.timelineSettings.defaultCurrency || 'USD';

    return (
      <div data-testid="report-view-budget" className="h-full overflow-y-auto p-6 bg-slate-50">
        <div className="max-w-3xl mx-auto">
          <BackButton onBack={() => setSelectedReport(null)} />
          <div data-testid="report-budget-summary" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">Budget Summary</h2>
              <div className="flex items-center gap-3 text-sm">
                <span data-testid="budget-grand-total-capex" className="text-blue-600"><span className="font-medium">CapEx</span> {fmt(grandCapex, currency)}</span>
                <span data-testid="budget-grand-total-opex" className="text-amber-600"><span className="font-medium">OpEx</span> {fmt(grandOpex, currency)}</span>
                <span data-testid="budget-grand-total" className="font-bold text-slate-700">{fmt(grandTotal, currency)} total</span>
              </div>
            </div>
            <div className="p-4 space-y-6">
              <BudgetSection testId="budget-by-programme" title="By Programme" rows={byProgramme} max={byProgramme[0]?.total ?? 0} currency={currency} />
              <BudgetSection testId="budget-by-strategy" title="By Strategy" rows={byStrategy} max={byStrategy[0]?.total ?? 0} currency={currency} />
              <BudgetSection testId="budget-by-category" title="By Category" rows={byCategory} max={byCategory[0]?.total ?? 0} currency={currency} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Initiatives & Dependencies ───────────────────────────────────────────────
  if (selectedReport === 'initiatives-dependencies') {
    const milestoneDeps = dependencies.filter(d => d.sourceType === 'milestone');

    return (
      <div data-testid="report-view-initiatives-dependencies" className="h-full overflow-y-auto p-6 bg-slate-50">
        <div className="max-w-3xl mx-auto space-y-6">
          <BackButton onBack={() => setSelectedReport(null)} />
          <div data-testid="report-dependencies">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Initiatives &amp; Dependencies</h2>
            {assets.map(asset => {
              const assetInitiatives = initiatives.filter(i => i.assetId === asset.id && !i.isPlaceholder);
              if (assetInitiatives.length === 0) return null;
              return (
                <section key={asset.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-700">{asset.name}</h3>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {assetInitiatives.map(init => {
                      const related = dependencies.filter(d => d.sourceId === init.id || d.targetId === init.id);
                      return (
                        <li key={init.id} className="px-4 py-3">
                          <p className="text-sm font-medium text-slate-800 mb-1">{init.name}</p>
                          {related.length === 0 ? (
                            <p className="text-xs text-slate-400">No dependencies</p>
                          ) : (
                            <ul className="space-y-0.5">
                              {related.map(dep => {
                                const src = initiatives.find(i => i.id === dep.sourceId);
                                const tgt = initiatives.find(i => i.id === dep.targetId);
                                if (!src || !tgt) return null;
                                return (
                                  <li key={dep.id} className="text-xs text-slate-600">
                                    {depSentence(dep, src, tgt, init.id)}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>

          {milestoneDeps.length > 0 && (
            <div data-testid="report-milestone-dependencies" className="space-y-4">
              <h2 className="text-base font-semibold text-slate-800">Milestone Dependencies</h2>
              <ul className="space-y-2">
                {milestoneDeps.map(dep => {
                  const mile = milestones.find(m => m.id === dep.sourceId);
                  const tgt = initiatives.find(i => i.id === dep.targetId);
                  if (!mile || !tgt) return null;
                  return (
                    <li key={dep.id} className="text-xs text-slate-600 flex items-start gap-2">
                      <span className="font-semibold text-slate-700">{mile.name}</span>
                      <span>→</span>
                      <span>{tgt.name} requires this milestone to be reached first.</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Maturity Heatmap ─────────────────────────────────────────────────────────
  if (selectedReport === 'maturity-heatmap') {
    const handleTileClick = (asset: Asset) => setSelectedAssetId(asset.id);
    const handleAssetSave = (updatedAsset: Asset) => {
      onSaveAsset?.(updatedAsset);
      setSelectedAssetId(null);
    };
    const handleAssetPanelClose = () => setSelectedAssetId(null);
    return (
      <div className="h-full overflow-y-auto p-6 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <BackButton onBack={() => setSelectedReport(null)} />
          <MaturityHeatmap
            assets={assets}
            assetCategories={assetCategories}
            onTileClick={handleTileClick}
          />
        </div>
        <AssetPanel
          asset={selectedAsset}
          assetCategories={assetCategories}
          isOpen={assetPanelOpen}
          onClose={handleAssetPanelClose}
          onSave={handleAssetSave}
        />
      </div>
    );
  }

  // ── RPTI Report ───────────────────────────────────────────────────────────────
  if (selectedReport === 'rpti') {
    return (
      <div data-testid="report-view-rpti" className="h-full overflow-y-auto p-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <BackButton onBack={() => setSelectedReport(null)} />
          <div className="mb-6">
            <h1 className="text-xl font-bold text-slate-800">RPTI Report</h1>
            <p className="text-sm text-slate-500 mt-1">
              Indonesian OJK IT Development Plan Report (Format 3.1) — planned application and infrastructure development.
            </p>
          </div>
          <div className="mb-4 flex items-end gap-3">
            <label className="text-sm font-medium text-slate-700" htmlFor="rpti-report-year-input">
              Filing year
            </label>
            <input
              id="rpti-report-year-input"
              data-testid="rpti-report-year-input"
              type="number"
              inputMode="numeric"
              value={rptiYearInput}
              onChange={event => setRptiYearInput(event.target.value)}
              placeholder="YYYY"
              className="w-28 px-3 py-2 border border-slate-300 rounded-lg"
            />
            <button
              data-testid="rpti-generate-report-btn"
              disabled={!rptiYear}
              onClick={generateRptiReport}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50"
            >
              Generate RPTI
            </button>
          </div>
          <RptiReportView
            rptiDetails={generatedRptiDetails ?? []}
            initiatives={initiatives}
            deliverables={deliverables}
            assets={assets}
            deliverableSegments={deliverableSegments}
            deliverableStatuses={deliverableStatuses}
            defaultCurrency={currentData.timelineSettings.defaultCurrency || 'USD'}
            reportYear={generatedRptiDetails ? rptiYear : undefined}
            blockingIssues={rptiPreExportIssues}
            onRepairUnresolvedRow={setRepairRowId}
          />
          {repairDialog}
        </div>
      </div>
    );
  }

  // ── LKPTI - Application List Report ───────────────────────────
  if (selectedReport === 'lkpti') {
    return (
      <div data-testid="report-view-lkpti" className="h-full overflow-y-auto p-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <BackButton onBack={() => setSelectedReport(null)} />
          <div className="mb-6">
            <h1 className="text-xl font-bold text-slate-800">LKPTI - Application List Report</h1>
            <p className="text-sm text-slate-500 mt-1">
              Indonesian OJK LKPTI Application List (Format 3.2.6) — an inventory of currently live applications.
            </p>
          </div>
          <div className="mb-4 flex items-end gap-3">
            <label className="text-sm font-medium text-slate-700" htmlFor="lkpti-report-year-input">
              As-at year
            </label>
            <input
              id="lkpti-report-year-input"
              data-testid="lkpti-report-year-input"
              type="number"
              inputMode="numeric"
              value={lkptiYearInput}
              onChange={event => setLkptiYearInput(event.target.value)}
              placeholder="YYYY"
              className="w-28 px-3 py-2 border border-slate-300 rounded-lg"
            />
            <button
              data-testid="lkpti-generate-report-btn"
              disabled={!lkptiYear}
              onClick={generateLkptiReport}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50"
            >
              Generate LKPTI
            </button>
          </div>
          <LkptiReportView
            lkptiDetails={generatedLkptiDetails ?? []}
            deliverables={deliverables}
            reportYear={generatedLkptiDetails ? lkptiYear : undefined}
          />
        </div>
      </div>
    );
  }

  // ── Data Health ──────────────────────────────────────────────────────────────
  if (selectedReport === 'data-health') {
    return (
      <div data-testid="report-view-data-health" className="h-full overflow-y-auto p-6 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <BackButton onBack={() => setSelectedReport(null)} />
          <div className="mb-6">
            <h1 className="text-xl font-bold text-slate-800">Data Health</h1>
            <p className="text-sm text-slate-500 mt-1">
              Dangling references, report-generation gaps, and values that would be rejected at filing time.
            </p>
          </div>
          <DataHealthReportView
            assets={assets}
            assetCategories={assetCategories}
            deliverables={deliverables}
            deliverableSegments={deliverableSegments}
            deliverableStatuses={deliverableStatuses}
            initiatives={initiatives}
            milestones={milestones}
            dependencies={dependencies}
            decisions={currentData.decisions ?? []}
            resources={resources}
            programmes={programmes}
            strategies={strategies}
            rptiDetails={rptiDetails}
            lkptiDetails={lkptiDetails}
            timelineSettings={currentData.timelineSettings}
            onNavigate={(location, entityName) => onNavigate?.(location, entityName)}
            onRepairUnresolvedRow={setRepairRowId}
            onExtendImportPriorPhase={onExtendImportPriorPhase}
          />
          {repairDialog}
        </div>
      </div>
    );
  }

  // ── Capacity & Resources ─────────────────────────────────────────────────────
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-NZ', { month: 'short', year: 'numeric' });
  const realInitiatives = initiatives.filter(i => !i.isPlaceholder);
  const assignmentsFor = (resourceId: string) =>
    realInitiatives.filter(i => i.ownerId === resourceId || (i.resourceIds ?? []).includes(resourceId));

  return (
    <div data-testid="report-view-capacity" className="h-full overflow-y-auto p-6 bg-slate-50">
      <div className="max-w-3xl mx-auto">
        <BackButton onBack={() => setSelectedReport(null)} />
        <div data-testid="capacity-report" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-800">Capacity Report</h2>
          </div>
          <div className="p-4">
            {resources.length === 0 ? (
              <p data-testid="capacity-no-resources" className="text-sm text-slate-400">
                No resources defined. Add resources in Data Manager → Resources to track capacity.
              </p>
            ) : (
              <div className="space-y-4">
                {resources.map(resource => {
                  const assigned = assignmentsFor(resource.id);
                  return (
                    <div key={resource.id} data-testid="capacity-resource-row" className="border border-slate-100 rounded-lg overflow-hidden">
                      <div data-testid={`capacity-resource-row-${resource.id}`} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="text-sm font-semibold text-slate-800">{resource.name}</span>
                            {resource.role && <span className="ml-2 text-xs text-slate-400">({resource.role})</span>}
                          </div>
                          <span
                            data-testid="capacity-assignment-count"
                            className={`text-xs font-bold px-2 py-0.5 rounded-full ${assigned.length === 0 ? 'bg-slate-100 text-slate-400' : assigned.length >= 3 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}
                          >
                            {assigned.length}
                          </span>
                        </div>
                        {assigned.length === 0 ? (
                          <p data-testid="capacity-no-assignments" className="text-xs text-slate-400 italic">No initiatives assigned</p>
                        ) : (
                          <ul className="space-y-1">
                            {assigned.map(init => (
                              <li key={init.id} className="flex items-center gap-2 text-xs text-slate-600">
                                {init.ownerId === resource.id && (
                                  <span className="text-[10px] font-bold bg-slate-200 text-slate-600 px-1 rounded uppercase">Owner</span>
                                )}
                                <span className="font-medium text-slate-700">{init.name}</span>
                                <span className="text-slate-400">{fmtDate(init.startDate)} → {fmtDate(init.endDate)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
