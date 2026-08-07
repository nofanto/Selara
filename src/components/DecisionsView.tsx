import React, { useState, useEffect } from 'react';
import { Decision, DecisionStatus, Initiative, Programme, Asset } from '../types';
import { ClipboardList, Plus, Save, Trash2, Pencil } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

interface DecisionsViewProps {
  decisions: Decision[];
  initiatives: Initiative[];
  programmes: Programme[];
  assets: Asset[];
  onAdd: (decision: Decision) => void;
  onUpdate: (decision: Decision) => void;
  onDelete: (decision: Decision) => void;
  selectedId: string | null;
  onSelectId: (id: string | null) => void;
}

const STATUS_OPTIONS: DecisionStatus[] = ['proposed', 'accepted', 'deprecated', 'superseded'];

const STATUS_BADGE_CLASS: Record<DecisionStatus, string> = {
  proposed: 'bg-slate-100 text-slate-600',
  accepted: 'bg-emerald-100 text-emerald-700',
  deprecated: 'bg-amber-100 text-amber-700',
  superseded: 'bg-slate-200 text-slate-500',
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function blankDecision(): Decision {
  return {
    id: `dec-${Date.now()}`,
    title: '',
    status: 'proposed',
    createdAt: new Date().toISOString(),
  };
}

export function DecisionsView({ decisions, initiatives, programmes, assets, onAdd, onUpdate, onDelete, selectedId, onSelectId }: DecisionsViewProps) {
  const [formData, setFormData] = useState<Decision | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [titleError, setTitleError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Decision | null>(null);

  // Whenever the selection changes (row click, or navigated to from a linked
  // entity panel), drop out of any in-progress create/edit form.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setFormData(null);
    setIsNew(false);
    setTitleError(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const sorted = [...decisions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const selected = decisions.find(d => d.id === selectedId) || null;
  const isEditing = formData !== null;

  const startCreate = () => {
    setFormData(blankDecision());
    setIsNew(true);
    setTitleError(false);
  };

  const startEdit = (decision: Decision) => {
    setFormData({ ...decision });
    setIsNew(false);
    setTitleError(false);
  };

  const cancelEdit = () => {
    setFormData(null);
    setIsNew(false);
    setTitleError(false);
  };

  const handleSave = () => {
    if (!formData || !formData.title.trim()) {
      setTitleError(true);
      return;
    }
    if (isNew) {
      onAdd(formData);
    } else {
      onUpdate(formData);
    }
    onSelectId(formData.id);
    setFormData(null);
    setIsNew(false);
    setTitleError(false);
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    onDelete(confirmDelete);
    if (selectedId === confirmDelete.id) onSelectId(null);
    setConfirmDelete(null);
  };

  const linkedEntityName = (d: Decision): string | null => {
    if (!d.linkedEntityType || !d.linkedEntityId) return null;
    if (d.linkedEntityType === 'initiative') return initiatives.find(i => i.id === d.linkedEntityId)?.name || null;
    if (d.linkedEntityType === 'programme') return programmes.find(p => p.id === d.linkedEntityId)?.name || null;
    if (d.linkedEntityType === 'asset') return assets.find(a => a.id === d.linkedEntityId)?.name || null;
    return null;
  };

  const linkedOptions = (type: Decision['linkedEntityType']): { id: string; name: string }[] => {
    if (type === 'initiative') return initiatives.map(i => ({ id: i.id, name: i.name }));
    if (type === 'programme') return programmes.map(p => ({ id: p.id, name: p.name }));
    if (type === 'asset') return assets.map(a => ({ id: a.id, name: a.name }));
    return [];
  };

  return (
    <div data-testid="decisions-view" className="flex flex-col h-full bg-slate-50 overflow-hidden">
      <div className="flex-1 overflow-hidden flex">
        {/* Sidebar: list of decisions */}
        <div className="w-80 shrink-0 border-r border-slate-200 flex flex-col bg-white">
          <div className="p-4 border-b border-slate-200">
            <button
              onClick={startCreate}
              data-testid="add-decision-btn"
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium text-sm shadow-sm"
            >
              <Plus size={16} />
              New Decision
            </button>
          </div>
          <div data-testid="decisions-list" className="flex-1 overflow-y-auto p-2 space-y-1">
            {sorted.length === 0 ? (
              <div className="p-8 text-center">
                <ClipboardList className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400">No decisions recorded yet</p>
              </div>
            ) : (
              sorted.map(d => (
                <div
                  key={d.id}
                  onClick={() => onSelectId(d.id)}
                  className={`p-3 rounded-xl cursor-pointer transition-all border ${
                    selectedId === d.id && !isEditing
                      ? 'bg-slate-50 border-blue-200 shadow-sm'
                      : 'border-transparent hover:bg-slate-50 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className="font-bold text-sm text-slate-800 truncate">{d.title}</h4>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${STATUS_BADGE_CLASS[d.status]}`}>
                      {d.status}
                    </span>
                  </div>
                  {linkedEntityName(d) && (
                    <p className="text-[11px] text-slate-400 truncate">&rarr; {linkedEntityName(d)}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Detail / form pane */}
        <div className="flex-1 overflow-y-auto p-6 bg-white">
          {isEditing && formData ? (
            <div className="max-w-xl space-y-4">
              <h3 className="text-lg font-bold text-slate-800">{isNew ? 'New Decision' : 'Edit Decision'}</h3>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                <input
                  autoFocus
                  type="text"
                  data-testid="decision-title-input"
                  value={formData.title}
                  onChange={(e) => { setFormData({ ...formData, title: e.target.value }); setTitleError(false); }}
                  className={`w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${titleError ? 'border-red-400' : 'border-slate-200'}`}
                />
                {titleError && <p data-testid="decision-title-error" className="text-xs text-red-500 mt-1">Title is required.</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select
                  data-testid="decision-status-select"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as DecisionStatus })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg shadow-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{capitalize(s)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Context</label>
                <textarea
                  data-testid="decision-context-input"
                  rows={3}
                  value={formData.context || ''}
                  onChange={(e) => setFormData({ ...formData, context: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="What's the situation or problem behind this decision?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Considered Options</label>
                <textarea
                  data-testid="decision-considered-options-input"
                  rows={3}
                  value={formData.consideredOptions || ''}
                  onChange={(e) => setFormData({ ...formData, consideredOptions: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="One option per line"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Decision Outcome</label>
                <textarea
                  data-testid="decision-outcome-input"
                  rows={2}
                  value={formData.decisionOutcome || ''}
                  onChange={(e) => setFormData({ ...formData, decisionOutcome: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Consequences</label>
                <textarea
                  data-testid="decision-consequences-input"
                  rows={2}
                  value={formData.consequences || ''}
                  onChange={(e) => setFormData({ ...formData, consequences: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Linked to</label>
                  <select
                    data-testid="decision-linked-type-select"
                    value={formData.linkedEntityType || ''}
                    onChange={(e) => {
                      const linkedEntityType = (e.target.value || undefined) as Decision['linkedEntityType'];
                      setFormData({ ...formData, linkedEntityType, linkedEntityId: undefined });
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg shadow-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">None</option>
                    <option value="initiative">Initiative</option>
                    <option value="programme">Programme</option>
                    <option value="asset">Asset</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Item</label>
                  <select
                    data-testid="decision-linked-id-select"
                    value={formData.linkedEntityId || ''}
                    disabled={!formData.linkedEntityType}
                    onChange={(e) => setFormData({ ...formData, linkedEntityId: e.target.value || undefined })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg shadow-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="">{formData.linkedEntityType ? 'Select...' : 'Pick a type first'}</option>
                    {linkedOptions(formData.linkedEntityType).map(o => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="flex-1 py-2 px-4 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  data-testid="save-decision-btn"
                  className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm flex items-center justify-center gap-2"
                >
                  <Save size={16} />
                  Save Decision
                </button>
              </div>
            </div>
          ) : selected ? (
            <div data-testid="decision-detail" className="max-w-xl space-y-5">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-1">{selected.title}</h3>
                  <p className="text-xs text-slate-400 font-mono">{new Date(selected.createdAt).toLocaleString()}</p>
                </div>
                <span data-testid="decision-status-badge" className={`text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded shrink-0 ${STATUS_BADGE_CLASS[selected.status]}`}>
                  {capitalize(selected.status)}
                </span>
              </div>

              {linkedEntityName(selected) && (
                <p className="text-sm text-slate-500">
                  Linked to <span className="font-medium text-slate-700">{linkedEntityName(selected)}</span> ({selected.linkedEntityType})
                </p>
              )}

              {selected.context && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Context</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{selected.context}</p>
                </div>
              )}
              {selected.consideredOptions && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Considered Options</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{selected.consideredOptions}</p>
                </div>
              )}
              {selected.decisionOutcome && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Decision Outcome</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{selected.decisionOutcome}</p>
                </div>
              )}
              {selected.consequences && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Consequences</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{selected.consequences}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => startEdit(selected)}
                  data-testid="edit-decision-btn"
                  className="flex-1 py-2 px-4 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm flex items-center justify-center gap-2"
                >
                  <Pencil size={14} />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(selected)}
                  data-testid="delete-decision-btn"
                  className="px-4 py-2 bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors font-medium text-sm flex items-center justify-center gap-2"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="p-6 bg-slate-50 rounded-full mb-4">
                <ClipboardList size={48} className="text-slate-200" />
              </div>
              <h3 className="text-lg font-bold text-slate-400">Select a decision to view details</h3>
              <p className="text-sm text-slate-400 max-w-xs mt-2">
                Decisions capture why a call was made about an initiative, programme, or asset.
              </p>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmDelete !== null}
        title="Delete Decision"
        message={confirmDelete ? `Sure you want to delete "${confirmDelete.title}"?` : ''}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
