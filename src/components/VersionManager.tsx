import React, { useState, useMemo } from 'react';
import { Version, Asset, Deliverable, DeliverableSegment, Initiative, Milestone, Programme, Strategy, Dependency, AssetCategory, TimelineSettings, Resource, DeliverableStatus, Decision, RptiDetail, LkptiDetail } from '../types';
import { X, Save, History, Trash2, ArrowRight, FileText, AlertCircle, Check } from 'lucide-react';
import { saveVersion, deleteVersion } from '../lib/db';
import { ConfirmModal } from './ConfirmModal';
import { computeDiff } from '../lib/diff';
import { decisionsForSpan } from '../lib/historyStream';
import { DiffSections } from './DiffSection';
import { useFocusTrap } from '../lib/useFocusTrap';


interface VersionManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore: (version: Version) => void;
  versions: Version[];
  onUpdateVersions: (versions: Version[]) => void;
  /** The live decision log — read for the difference report, appended to on capture. */
  decisions: Decision[];
  onAddDecision: (decision: Decision) => void;
  currentData: {
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
    deliverableStatuses?: DeliverableStatus[];
    decisions?: Decision[];
    rptiDetails?: RptiDetail[];
    lkptiDetails?: LkptiDetail[];
  };
}

export function VersionManager({ isOpen, onClose, onRestore, versions, onUpdateVersions, currentData, decisions, onAddDecision }: VersionManagerProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [captureDecision, setCaptureDecision] = useState(false);
  const [captureTitle, setCaptureTitle] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [comparisonVersionId, setComparisonVersionId] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const panelRef = useFocusTrap(isOpen, onClose);

  const sortedVersions = useMemo(() => 
    [...versions].sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
  [versions]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const version: Version = {
      id: `ver-${Date.now()}`,
      name: newName,
      timestamp: new Date().toISOString(),
      description: newDescription,
      data: structuredClone({
        ...currentData,
        deliverableStatuses: currentData.deliverableStatuses || [],
        decisions: currentData.decisions || [],
        rptiDetails: currentData.rptiDetails || [],
        lkptiDetails: currentData.lkptiDetails || [],
      }),
    };

    await saveVersion(version);
    onUpdateVersions([...versions, version]);

    // Capture-at-save (user story 24 AC2): the trigger the decision log has
    // always lacked. Only fires on explicit opt-in *and* a non-empty title, so
    // an abandoned dialog leaves no half-written record — and it never gates
    // the save itself (AC6). Defaults to 'accepted' rather than 'proposed':
    // the snapshot exists because a change was made, so the record describes
    // work already done.
    if (captureDecision && captureTitle.trim()) {
      onAddDecision({
        id: `dec-${Date.now()}`,
        title: captureTitle.trim(),
        status: 'accepted',
        createdAt: version.timestamp,
        context: newDescription.trim() || undefined,
        versionId: version.id,
      });
    }

    setNewName('');
    setNewDescription('');
    setCaptureDecision(false);
    setCaptureTitle('');
    setIsSaving(false);
  };

  const handleDelete = (id: string) => {
    setPendingConfirm({
      title: 'Delete Version',
      message: 'Are you sure you want to delete this version?',
      onConfirm: async () => {
        setPendingConfirm(null);
        await deleteVersion(id);
        onUpdateVersions(versions.filter(v => v.id !== id));
        if (selectedVersionId === id) setSelectedVersionId(null);
        if (comparisonVersionId === id) setComparisonVersionId(null);
      },
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div ref={panelRef} className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col relative animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <History size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Version History</h2>
              <p className="text-sm text-slate-500">Save snapshots and compare changes over time</p>
            </div>
          </div>
          <button
            onClick={onClose}
            data-testid="close-version-manager"
            aria-label="Close"
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Sidebar: List of Versions */}
          <div className="w-1/3 border-r border-slate-100 flex flex-col bg-slate-50/30">
            <div className="p-4 border-b border-slate-100">
              <button
                onClick={() => setIsSaving(true)}
                className="w-full py-2 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 font-medium shadow-sm"
              >
                <Save size={18} />
                Save Current State
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sortedVersions.length === 0 ? (
                <div className="p-8 text-center">
                  <History className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">No versions saved yet</p>
                </div>
              ) : (
                sortedVersions.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVersionId(v.id)}
                    className={`p-3 rounded-xl cursor-pointer transition-all border ${
                      selectedVersionId === v.id
                        ? 'bg-white border-indigo-200 shadow-sm'
                        : 'border-transparent hover:bg-white hover:border-slate-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h4 className={`font-bold text-sm truncate ${selectedVersionId === v.id ? 'text-indigo-600' : 'text-slate-800'}`}>
                        {v.name}
                      </h4>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(v.id);
                        }}
                        title="Delete version"
                        data-testid="delete-version-btn"
                        className="p-1 text-slate-300 hover:text-red-500 rounded-md transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {new Date(v.timestamp).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto p-6 bg-white">
            {isSaving ? (
              <div className="max-w-md mx-auto">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Save className="text-indigo-500" size={20} />
                  Save New Version
                </h3>
                <form onSubmit={handleSave} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Version Name</label>
                    <input
                      autoFocus
                      type="text"
                      required
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g., March 2026 Snapshot"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
                    <textarea
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="What changes does this version capture?"
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                    />
                  </div>
                  {/*
                    Capture-at-save (user story 24 AC2). The decision log's problem was
                    never that people won't record reasoning — it's that nothing ever
                    asked them at the moment they had it. This is an invitation, never a
                    gate: unchecked, or checked with an empty title, the save proceeds
                    untouched (AC6).
                  */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        data-testid="capture-decision-toggle"
                        checked={captureDecision}
                        onChange={(e) => setCaptureDecision(e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>
                        <span className="block text-sm font-medium text-slate-700">Record why (optional)</span>
                        <span className="block text-xs text-slate-500">
                          Adds a decision to the log, linked to this snapshot, so the reasoning outlives the diff.
                        </span>
                      </span>
                    </label>
                    {captureDecision && (
                      <input
                        type="text"
                        data-testid="capture-decision-title"
                        value={captureTitle}
                        onChange={(e) => setCaptureTitle(e.target.value)}
                        placeholder="e.g., Deferred the mobile programme after the vendor withdrew"
                        className="mt-3 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                      />
                    )}
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsSaving(false)}
                      className="flex-1 py-2 px-4 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm"
                    >
                      Save Version
                    </button>
                  </div>
                </form>
              </div>
            ) : selectedVersionId ? (
              <div className="space-y-6">
                {/* Version Details Header */}
                <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 mb-1">
                      {sortedVersions.find(v => v.id === selectedVersionId)?.name}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {sortedVersions.find(v => v.id === selectedVersionId)?.description || 'No description provided'}
                    </p>
                  </div>
                  <div className="text-right font-mono text-xs text-slate-400">
                    ID: {selectedVersionId}
                  </div>
                </div>

                {/* Actions Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border border-slate-100 rounded-xl bg-slate-50/50 hover:bg-white hover:border-indigo-100 transition-all group">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-white rounded-lg text-indigo-500 shadow-sm">
                        <ArrowRight size={18} />
                      </div>
                      <h4 className="font-bold text-slate-800">Compare with Current</h4>
                    </div>
                    <p className="text-xs text-slate-500 mb-3">See exactly what has changed since this version was saved.</p>
                    <button 
                      onClick={() => setComparisonVersionId('current')}
                      className="w-full py-2 bg-white border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors text-xs font-bold"
                    >
                      Run Difference Report
                    </button>
                  </div>

                  <div className="p-4 border border-slate-100 rounded-xl bg-slate-50/50 hover:bg-white hover:border-emerald-100 transition-all">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-white rounded-lg text-emerald-500 shadow-sm">
                        <FileText size={18} />
                      </div>
                      <h4 className="font-bold text-slate-800">Restore Version</h4>
                    </div>
                    <p className="text-xs text-slate-500 mb-3 text-red-500 flex items-center gap-1">
                      <AlertCircle size={10} />
                      Warning: Overwrites current work!
                    </p>
                    <button
                      onClick={() => {
                        const v = sortedVersions.find(v => v.id === selectedVersionId);
                        if (v) {
                          setPendingConfirm({
                            title: 'Restore Version',
                            message: `Restore "${v.name}"? This will overwrite all your current work.`,
                            onConfirm: () => { setPendingConfirm(null); onRestore(v); onClose(); },
                          });
                        }
                      }}
                      className="w-full py-2 bg-white border border-emerald-200 text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors text-xs font-bold"
                    >
                      Restore to Current
                    </button>
                  </div>
                </div>

                {/* Stats Summary */}
                <div className="bg-indigo-900 rounded-xl p-5 text-white shadow-inner">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300 mb-3">Snapshot Stats</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-2xl font-bold">
                        {sortedVersions.find(v => v.id === selectedVersionId)?.data.initiatives.length}
                      </p>
                      <p className="text-[10px] text-indigo-300 uppercase font-bold">Initiatives</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {sortedVersions.find(v => v.id === selectedVersionId)?.data.dependencies.length}
                      </p>
                      <p className="text-[10px] text-indigo-300 uppercase font-bold">Relationships</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-indigo-300">$</p>
                      <p className="text-[10px] text-indigo-300 uppercase font-bold">Financials</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="p-6 bg-slate-50 rounded-full mb-4">
                  <History size={48} className="text-slate-200" />
                </div>
                <h3 className="text-lg font-bold text-slate-400">Select a version to view details</h3>
                <p className="text-sm text-slate-400 max-w-xs mt-2">
                  Snapshots capture all initiatives, dependencies, and settings for reporting.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0 rounded-b-2xl">
          <p className="text-xs text-center text-slate-400">
            Versions are stored locally in your browser and are not shared.
          </p>
        </div>
      </div>
      
      {/* Comparison Modal Overlay */}
      {comparisonVersionId && (() => {
        const baseVersion = sortedVersions.find(v => v.id === selectedVersionId);
        if (!baseVersion) return null;
        return (
          <VersionComparisonReport
            baseVersion={baseVersion}
            comparisonData={currentData}
            decisions={decisions}
            onClose={() => setComparisonVersionId(null)}
          />
        );
      })()}
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

// Sub-component for the Report
function VersionComparisonReport({ baseVersion, comparisonData, decisions, onClose }: {
  baseVersion: Version,
  comparisonData: Version['data'],
  decisions: Decision[],
  onClose: () => void
}) {
  const diff = useMemo(() => computeDiff(baseVersion, comparisonData), [baseVersion, comparisonData]);
  // The report always compares the baseline against the live workspace, so the
  // far end of the span is "now" — an endpoint with a timestamp but no version.
  const spanDecisions = useMemo(
    () => decisionsForSpan(decisions, baseVersion, { id: '', timestamp: new Date().toISOString() }),
    [decisions, baseVersion],
  );

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-6">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col relative animate-in slide-in-from-bottom-8 duration-300">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-50/30 rounded-t-3xl">
          <h3 className="text-xl font-bold text-slate-900">Difference Report</h3>
          <button
            onClick={onClose}
            data-testid="close-report"
            aria-label="Close"
            className="p-2 hover:bg-white rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-10">
          <div className="flex items-center gap-4 bg-indigo-50 p-4 rounded-2xl border border-indigo-100 shrink-0">
            <div className="flex-1 text-center">
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Baseline</p>
              <p className="font-bold text-indigo-900 truncate px-2">{baseVersion.name}</p>
            </div>
            <ArrowRight className="text-indigo-300" />
            <div className="flex-1 text-center">
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Current State</p>
              <p className="font-bold text-indigo-900">Today</p>
            </div>
          </div>

          {/*
            AC3 — the payoff. Decisions had zero presence in the surface people
            actually use, so writing one was unrewarded. Listing them here is what
            makes the log worth keeping: it turns "I wrote this down" into "my own
            diffs explain themselves". An empty span says so out loud, so a change
            nobody documented reads as a visible gap rather than silence.
          */}
          <div data-testid="diff-decisions" className="rounded-2xl border border-slate-200 p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              Decisions in this span
            </p>
            {spanDecisions.length === 0 ? (
              <p className="text-sm text-slate-400">
                No decisions recorded for this period — nothing explains why these changes were made.
              </p>
            ) : (
              <ul className="space-y-2">
                {spanDecisions.map(d => (
                  <li key={d.id} className="flex items-start gap-2">
                    <FileText size={14} className="mt-0.5 text-slate-300 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{d.title}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(d.createdAt).toLocaleDateString()} &middot; {d.status}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!diff.hasChanges ? (
            <div className="py-20 text-center text-slate-400">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={40} className="opacity-20 text-emerald-500" />
              </div>
              <p className="font-bold text-slate-500">No changes detected</p>
              <p className="text-sm mt-1">This version exactly matches the current state.</p>
            </div>
          ) : (
            <DiffSections diff={diff} />
          )}
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-3xl shrink-0">
          <button 
            onClick={onClose}
            data-testid="close-report-btn"
            className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
}
