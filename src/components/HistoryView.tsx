import React, { useMemo, useState } from 'react';
import {
  Version, Decision, Asset, Deliverable, DeliverableSegment, Initiative, Milestone,
  Programme, Strategy, Dependency, AssetCategory, TimelineSettings, Resource,
  DeliverableStatus, RptiDetail, LkptiDetail,
} from '../types';
import { History, Save, Trash2, Plus, ArrowRight, FileText, AlertCircle, ClipboardList } from 'lucide-react';
import { saveVersion, deleteVersion } from '../lib/db';
import { buildHistoryStream } from '../lib/historyStream';
import { ConfirmModal } from './ConfirmModal';
import { VersionComparisonReport } from './VersionDiffReport';
import { DecisionsView } from './DecisionsView';

type CurrentData = {
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

interface HistoryViewProps {
  versions: Version[];
  onUpdateVersions: (versions: Version[]) => void;
  onRestore: (version: Version) => void;
  currentData: CurrentData;
  decisions: Decision[];
  initiatives: Initiative[];
  programmes: Programme[];
  assets: Asset[];
  onAddDecision: (d: Decision) => void;
  onUpdateDecision: (d: Decision) => void;
  onDeleteDecision: (d: Decision) => void;
  selectedDecisionId: string | null;
  onSelectDecisionId: (id: string | null) => void;
}

/**
 * The History tab — one destination for what changed and why (user story 24 AC1).
 *
 * Versions and decisions stay separate records, deliberately: a Version is an
 * immutable, mechanically-diffable snapshot; a Decision is a mutable MADR record
 * with its own status lifecycle. What merges is the *destination*. Interleaving
 * them in one stream is the point — a snapshot with no decision beside it reads
 * as a visible gap rather than an absence nobody notices.
 */
export function HistoryView({
  versions, onUpdateVersions, onRestore, currentData, decisions,
  initiatives, programmes, assets,
  onAddDecision, onUpdateDecision, onDeleteDecision,
  selectedDecisionId, onSelectDecisionId,
}: HistoryViewProps) {
  const [filter, setFilter] = useState<'all' | 'decisions'>('all');
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [captureDecision, setCaptureDecision] = useState(false);
  const [captureTitle, setCaptureTitle] = useState('');
  const [comparisonVersionId, setComparisonVersionId] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  // Bumped to ask DecisionsView to open a blank form. A signal rather than lifted
  // form state: the create/edit logic there is already covered by its own tests,
  // and moving it would be a bigger change than this tab warrants.
  const [createRequestId, setCreateRequestId] = useState(0);

  const stream = useMemo(() => buildHistoryStream(versions, decisions), [versions, decisions]);
  const visible = filter === 'decisions'
    ? stream.filter(e => e.kind === 'decision' || (e.kind === 'version' && e.decisions.length > 0))
    : stream;

  const selectedVersion = versions.find(v => v.id === selectedVersionId) || null;

  /**
   * #31 defect 2, carried into the stream: a decision whose linked entity has been
   * deleted must still show that a link existed. Without this the refactor would
   * quietly reintroduce the bug the stream replaced the old list to fix.
   */
  const hasBrokenLink = (d: Decision) => {
    if (!d.linkedEntityType || !d.linkedEntityId) return false;
    const found =
      d.linkedEntityType === 'initiative' ? initiatives.some(i => i.id === d.linkedEntityId) :
      d.linkedEntityType === 'programme' ? programmes.some(p => p.id === d.linkedEntityId) :
      d.linkedEntityType === 'asset' ? assets.some(a => a.id === d.linkedEntityId) :
      false;
    return !found;
  };

  const selectVersion = (id: string) => {
    setSelectedVersionId(id);
    onSelectDecisionId(null);
    setIsSaving(false);
  };

  const selectDecision = (id: string) => {
    onSelectDecisionId(id);
    setSelectedVersionId(null);
    setIsSaving(false);
  };

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

    // Capture-at-save (AC2). Only on explicit opt-in *with* a title, so an
    // abandoned form leaves no half-written record, and it never gates the save
    // itself (AC6). Defaults to 'accepted': the snapshot exists because a change
    // was made, so the record describes work already done.
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

  const handleDeleteVersion = (v: Version) => {
    // #31 defect 3. Decisions linked to this snapshot are NOT deleted with it —
    // ADR-0011, the log outlives what it describes — but their versionId stops
    // resolving, so say so rather than letting the link break silently. Worded
    // apart from any removal language for the same reason as the entity cascades.
    const linked = decisions.filter(d => d.versionId === v.id).length;
    const message = linked
      ? `Delete "${v.name}"? ${linked} decision(s) will keep their record but lose their link to it.`
      : `Delete "${v.name}"?`;

    setPendingConfirm({
      title: 'Delete Version',
      message,
      onConfirm: async () => {
        setPendingConfirm(null);
        await deleteVersion(v.id);
        onUpdateVersions(versions.filter(x => x.id !== v.id));
        if (selectedVersionId === v.id) setSelectedVersionId(null);
        if (comparisonVersionId === v.id) setComparisonVersionId(null);
      },
    });
  };

  return (
    <div data-testid="history-view" className="flex flex-col h-full bg-slate-50 overflow-hidden">
      <div className="flex-1 overflow-hidden flex">
        {/* Stream */}
        <div className="w-80 shrink-0 border-r border-slate-200 flex flex-col bg-white">
          <div className="p-4 border-b border-slate-200 space-y-2">
            <button
              onClick={() => { setIsSaving(true); setSelectedVersionId(null); onSelectDecisionId(null); }}
              data-testid="save-version-btn"
              className="w-full py-2 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 font-medium text-sm shadow-sm"
            >
              <Save size={16} />
              Save Current State
            </button>
            <button
              onClick={() => { setCreateRequestId(n => n + 1); setSelectedVersionId(null); setIsSaving(false); }}
              data-testid="new-decision-btn"
              className="w-full py-2 px-4 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 font-medium text-sm"
            >
              <Plus size={16} />
              New Decision
            </button>
          </div>

          <div className="flex gap-1 p-2 border-b border-slate-100" role="tablist">
            {(['all', 'decisions'] as const).map(key => (
              <button
                key={key}
                role="tab"
                aria-selected={filter === key}
                data-testid={`history-filter-${key}`}
                onClick={() => setFilter(key)}
                className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
                  filter === key ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {key === 'all' ? 'Everything' : 'Decisions only'}
              </button>
            ))}
          </div>

          <div data-testid="history-stream" className="flex-1 overflow-y-auto p-2 space-y-1">
            {visible.length === 0 ? (
              <div className="p-8 text-center">
                <History className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Nothing recorded yet</p>
              </div>
            ) : visible.map(entry => entry.kind === 'version' ? (
              <div
                key={entry.id}
                data-testid={`history-entry-${entry.id}`}
                onClick={() => selectVersion(entry.id)}
                className={`p-3 rounded-xl cursor-pointer transition-all border ${
                  selectedVersionId === entry.id ? 'bg-slate-50 border-indigo-200 shadow-sm' : 'border-transparent hover:bg-slate-50 hover:border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-bold text-sm text-slate-800 truncate flex items-center gap-1.5">
                    <History size={12} className="text-indigo-400 shrink-0" />
                    {entry.version.name}
                  </h4>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 bg-indigo-50 text-indigo-600">snapshot</span>
                </div>
                <p className="text-[10px] text-slate-400 font-mono mt-1">{new Date(entry.timestamp).toLocaleString()}</p>
                {entry.decisions.map(d => (
                  <button
                    key={d.id}
                    onClick={(e) => { e.stopPropagation(); selectDecision(d.id); }}
                    className="block w-full text-left text-[11px] text-slate-500 hover:text-blue-600 truncate mt-1"
                  >
                    &rarr; {d.title}
                  </button>
                ))}
              </div>
            ) : (
              <div
                key={entry.id}
                data-testid={`history-entry-${entry.id}`}
                onClick={() => selectDecision(entry.id)}
                className={`p-3 rounded-xl cursor-pointer transition-all border ${
                  selectedDecisionId === entry.id ? 'bg-slate-50 border-blue-200 shadow-sm' : 'border-transparent hover:bg-slate-50 hover:border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-bold text-sm text-slate-800 truncate flex items-center gap-1.5">
                    <ClipboardList size={12} className="text-blue-400 shrink-0" />
                    {entry.decision.title}
                  </h4>
                </div>
                <p className="text-[10px] text-slate-400 font-mono mt-1">{new Date(entry.timestamp).toLocaleString()}</p>
                {hasBrokenLink(entry.decision) && (
                  <p data-testid="decision-link-missing" className="text-[11px] text-amber-600 italic truncate">
                    &rarr; linked item no longer exists
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Detail */}
        <div className="flex-1 overflow-y-auto bg-white">
          {isSaving ? (
            <form onSubmit={handleSave} className="max-w-md p-6 space-y-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Save className="text-indigo-500" size={20} />
                Save New Version
              </h3>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Version Name</label>
                <input
                  autoFocus
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
                <button type="button" onClick={() => setIsSaving(false)} className="flex-1 py-2 px-4 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-2 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-sm">
                  Save Version
                </button>
              </div>
            </form>
          ) : selectedVersion ? (
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-1">{selectedVersion.name}</h3>
                  <p className="text-sm text-slate-500">{selectedVersion.description || 'No description provided'}</p>
                  <p className="text-xs text-slate-400 font-mono mt-1">{new Date(selectedVersion.timestamp).toLocaleString()}</p>
                </div>
                <button
                  onClick={() => handleDeleteVersion(selectedVersion)}
                  data-testid="delete-version-btn"
                  title="Delete version"
                  className="p-2 text-slate-300 hover:text-red-500 rounded-md transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border border-slate-100 rounded-xl bg-slate-50/50">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-white rounded-lg text-indigo-500 shadow-sm"><ArrowRight size={18} /></div>
                    <h4 className="font-bold text-slate-800">Compare with Current</h4>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">See exactly what has changed since this version was saved.</p>
                  <button
                    onClick={() => setComparisonVersionId('current')}
                    className="w-full py-2 bg-white border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50 text-xs font-bold"
                  >
                    Run Difference Report
                  </button>
                </div>

                <div className="p-4 border border-slate-100 rounded-xl bg-slate-50/50">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-white rounded-lg text-emerald-500 shadow-sm"><FileText size={18} /></div>
                    <h4 className="font-bold text-slate-800">Restore Version</h4>
                  </div>
                  <p className="text-xs mb-3 text-red-500 flex items-center gap-1">
                    <AlertCircle size={10} />
                    Overwrites current work — the decision log is kept
                  </p>
                  <button
                    onClick={() => setPendingConfirm({
                      title: 'Restore Version',
                      message: `Restore "${selectedVersion.name}"? This will overwrite all your current work. Your decision log is not rolled back.`,
                      onConfirm: () => { setPendingConfirm(null); onRestore(selectedVersion); },
                    })}
                    className="w-full py-2 bg-white border border-emerald-200 text-emerald-600 rounded-lg hover:bg-emerald-50 text-xs font-bold"
                  >
                    Restore to Current
                  </button>
                </div>
              </div>

              {/* AC5: the snapshot names the reasoning recorded against it. */}
              <div data-testid="version-linked-decisions" className="rounded-xl border border-slate-200 p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Decisions recorded here</p>
                {decisions.filter(d => d.versionId === selectedVersion.id).length === 0 ? (
                  <p className="text-sm text-slate-400">No decision was recorded against this snapshot.</p>
                ) : (
                  <ul className="space-y-2">
                    {decisions.filter(d => d.versionId === selectedVersion.id).map(d => (
                      <li key={d.id}>
                        <button
                          onClick={() => selectDecision(d.id)}
                          className="text-sm text-left text-slate-800 hover:text-blue-600 font-medium"
                        >
                          {d.title}
                        </button>
                        <p className="text-xs text-slate-400">{d.status}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <DecisionsView
              variant="detail"
              createRequestId={createRequestId}
              decisions={decisions}
              initiatives={initiatives}
              programmes={programmes}
              assets={assets}
              versions={versions}
              onSelectVersionId={selectVersion}
              onAdd={onAddDecision}
              onUpdate={onUpdateDecision}
              onDelete={onDeleteDecision}
              selectedId={selectedDecisionId}
              onSelectId={onSelectDecisionId}
            />
          )}
        </div>
      </div>

      {comparisonVersionId && selectedVersion && (
        <VersionComparisonReport
          baseVersion={selectedVersion}
          comparisonData={currentData as Version['data']}
          decisions={decisions}
          onClose={() => setComparisonVersionId(null)}
        />
      )}

      <ConfirmModal
        isOpen={pendingConfirm !== null}
        title={pendingConfirm?.title || ''}
        message={pendingConfirm?.message || ''}
        confirmLabel={pendingConfirm?.title === 'Delete Version' ? 'Delete' : 'Restore'}
        onConfirm={() => pendingConfirm?.onConfirm()}
        onCancel={() => setPendingConfirm(null)}
      />
    </div>
  );
}
