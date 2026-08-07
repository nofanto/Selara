import React, { useState } from 'react';
import { RptiDetail, RptiCategoryCode, RptiDevelopmentType, RptiDeveloper, RptiRelatedParty, RptiQuarter, RptiTargetType, Initiative, Application, Asset, ApplicationSegment, ApplicationStatus, Milestone } from '../types';
import { Plus, Pencil, Trash2, Download } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';
import { RPTI_CATEGORY_LABELS, deriveQuarterFromDate, suggestApplicationQuarter, resolveCost, checkBudgetAllocation, exportRptiReportToExcel } from '../lib/rpti';

interface RptiReportViewProps {
  rptiDetails: RptiDetail[];
  initiatives: Initiative[];
  applications: Application[];
  assets: Asset[];
  applicationSegments: ApplicationSegment[];
  applicationStatuses: ApplicationStatus[];
  milestones: Milestone[];
  onAdd: (detail: RptiDetail) => void;
  onUpdate: (detail: RptiDetail) => void;
  onDelete: (detail: RptiDetail) => void;
}

const CATEGORY_CODES = Object.keys(RPTI_CATEGORY_LABELS) as RptiCategoryCode[];

function blankDetail(): RptiDetail {
  return {
    id: `rpti-${Date.now()}`,
    initiativeId: '',
    targetType: 'application',
    targetId: '',
    categoryCode: '06',
    developmentType: 'new',
    developer: 'inhouse',
    ppjtiRelatedParty: 'n/a',
  };
}

const selectClass = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';
const inputClass = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500';

function field(label: string, children: React.ReactNode) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

export function RptiReportView({ rptiDetails, initiatives, applications, assets, applicationSegments, applicationStatuses, milestones, onAdd, onUpdate, onDelete }: RptiReportViewProps) {
  const [formData, setFormData] = useState<RptiDetail | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<RptiDetail | null>(null);

  const targetName = (detail: RptiDetail): string => {
    if (detail.targetType === 'application') return applications.find(a => a.id === detail.targetId)?.name ?? '—';
    return assets.find(a => a.id === detail.targetId)?.name ?? '—';
  };

  const startCreate = () => {
    setFormData(blankDetail());
    setIsNew(true);
  };
  const startEdit = (detail: RptiDetail) => {
    setFormData({ ...detail });
    setIsNew(false);
  };
  const cancelEdit = () => setFormData(null);

  const handleSave = () => {
    if (!formData || !formData.initiativeId || !formData.targetId) return;
    if (isNew) onAdd(formData); else onUpdate(formData);
    setFormData(null);
    setIsNew(false);
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    onDelete(confirmDelete);
    setConfirmDelete(null);
  };

  const targetOptions = (type: RptiTargetType) =>
    type === 'application'
      ? applications.map(a => ({ id: a.id, name: a.name }))
      : assets.map(a => ({ id: a.id, name: a.name }));

  const suggestion = formData && formData.targetType === 'application' && formData.targetId && formData.initiativeId
    ? suggestApplicationQuarter(formData, applicationSegments, applicationStatuses)
    : {};

  const budgetWarning = formData?.initiativeId
    ? (() => {
        const initiative = initiatives.find(i => i.id === formData.initiativeId);
        if (!initiative) return null;
        const others = rptiDetails.filter(r => r.id !== formData.id);
        return checkBudgetAllocation(formData.initiativeId, [...others, formData], initiative);
      })()
    : null;

  const assetMilestoneOptions = formData && formData.targetType === 'asset' && formData.targetId
    ? milestones.filter(m => m.assetId === formData.targetId)
    : [];

  return (
    <div data-testid="rpti-report-view" className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={startCreate}
          data-testid="add-rpti-detail-btn"
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
        >
          <Plus size={16} />
          Add Row
        </button>
        <div className="flex-1" />
        {rptiDetails.length > 0 && (
          <button
            onClick={() => exportRptiReportToExcel(rptiDetails, initiatives, applications, assets, applicationSegments, applicationStatuses)}
            data-testid="rpti-report-export-btn"
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
          >
            <Download size={16} />
            Export to Excel
          </button>
        )}
      </div>

      {formData ? (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 max-w-2xl">
          <h3 className="text-base font-semibold text-slate-800">{isNew ? 'New RPTI Row' : 'Edit RPTI Row'}</h3>

          <div className="grid grid-cols-2 gap-3">
            {field('Initiative',
              <select data-testid="rpti-initiative-select" value={formData.initiativeId} onChange={e => setFormData({ ...formData, initiativeId: e.target.value })} className={selectClass}>
                <option value="">Select an initiative…</option>
                {initiatives.filter(i => !i.isPlaceholder).map(i => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            )}
            {field('Target Type',
              <select
                data-testid="rpti-target-type-select"
                value={formData.targetType}
                onChange={e => setFormData({ ...formData, targetType: e.target.value as RptiTargetType, targetId: '' })}
                className={selectClass}
              >
                <option value="application">Application</option>
                <option value="asset">Asset / Infrastructure</option>
              </select>
            )}
          </div>

          {field(formData.targetType === 'application' ? 'Application' : 'Asset',
            <select data-testid="rpti-target-id-select" value={formData.targetId} onChange={e => setFormData({ ...formData, targetId: e.target.value })} className={selectClass}>
              <option value="">Select…</option>
              {targetOptions(formData.targetType).map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          )}

          <div className="grid grid-cols-2 gap-3">
            {field('Category',
              <select data-testid="rpti-category-select" value={formData.categoryCode} onChange={e => setFormData({ ...formData, categoryCode: e.target.value as RptiCategoryCode })} className={selectClass}>
                {CATEGORY_CODES.map(code => (
                  <option key={code} value={code}>{code} — {RPTI_CATEGORY_LABELS[code]}</option>
                ))}
              </select>
            )}
            {field('Development Type',
              <select data-testid="rpti-dev-type-select" value={formData.developmentType} onChange={e => setFormData({ ...formData, developmentType: e.target.value as RptiDevelopmentType })} className={selectClass}>
                <option value="new">New</option>
                <option value="upgrade">Upgrade</option>
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {field('Developer',
              <select data-testid="rpti-developer-select" value={formData.developer} onChange={e => setFormData({ ...formData, developer: e.target.value as RptiDeveloper })} className={selectClass}>
                <option value="inhouse">In-house</option>
                <option value="PPJTI">PPJTI</option>
              </select>
            )}
            {field('PPJTI Related Party',
              <select data-testid="rpti-ppjti-select" value={formData.ppjtiRelatedParty} onChange={e => setFormData({ ...formData, ppjtiRelatedParty: e.target.value as RptiRelatedParty })} className={selectClass}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="n/a">N/A</option>
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {field('Data Center City', <input type="text" value={formData.location?.dataCenter?.city ?? ''} onChange={e => setFormData({ ...formData, location: { ...formData.location, dataCenter: { ...formData.location?.dataCenter, city: e.target.value } } })} className={inputClass} />)}
            {field('Data Center Country', <input type="text" value={formData.location?.dataCenter?.country ?? ''} onChange={e => setFormData({ ...formData, location: { ...formData.location, dataCenter: { ...formData.location?.dataCenter, country: e.target.value } } })} className={inputClass} />)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('DR Center City', <input type="text" value={formData.location?.disasterRecoveryCenter?.city ?? ''} onChange={e => setFormData({ ...formData, location: { ...formData.location, disasterRecoveryCenter: { ...formData.location?.disasterRecoveryCenter, city: e.target.value } } })} className={inputClass} />)}
            {field('DR Center Country', <input type="text" value={formData.location?.disasterRecoveryCenter?.country ?? ''} onChange={e => setFormData({ ...formData, location: { ...formData.location, disasterRecoveryCenter: { ...formData.location?.disasterRecoveryCenter, country: e.target.value } } })} className={inputClass} />)}
          </div>

          <div>
            {field('Planned Implementation Quarter',
              <select data-testid="rpti-quarter-select" value={formData.plannedImplementationQuarter ?? ''} onChange={e => setFormData({ ...formData, plannedImplementationQuarter: (e.target.value || undefined) as RptiQuarter | undefined })} className={selectClass}>
                <option value="">— Not set —</option>
                <option value="Q1">Q1</option>
                <option value="Q2">Q2</option>
                <option value="Q3">Q3</option>
                <option value="Q4">Q4</option>
              </select>
            )}
            {suggestion.quarter && suggestion.quarter !== formData.plannedImplementationQuarter && (
              <div className="mt-2 flex items-center gap-2 text-xs bg-blue-50 border border-blue-100 text-blue-700 rounded-lg px-3 py-2">
                <span>Suggested: {suggestion.quarter} (from linked lifecycle segment)</span>
                <button
                  type="button"
                  data-testid="rpti-quarter-suggestion-accept"
                  onClick={() => setFormData({ ...formData, plannedImplementationQuarter: suggestion.quarter, applicationSegmentId: suggestion.segmentId })}
                  className="font-semibold underline"
                >
                  Use this
                </button>
              </div>
            )}
            {formData.targetType === 'asset' && assetMilestoneOptions.length > 0 && (
              <div className="mt-2">
                <label className="block text-xs text-slate-500 mb-1">Copy date from an existing milestone</label>
                <select
                  data-testid="rpti-milestone-copy-select"
                  defaultValue=""
                  onChange={e => {
                    const m = assetMilestoneOptions.find(m => m.id === e.target.value);
                    if (m) setFormData({ ...formData, plannedImplementationQuarter: deriveQuarterFromDate(m.date) });
                  }}
                  className={selectClass}
                >
                  <option value="">Select a milestone…</option>
                  {assetMilestoneOptions.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.date})</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {field('CapEx Override ($)', <input type="number" data-testid="rpti-capex-amount-input" value={formData.capexAmount ?? ''} onChange={e => setFormData({ ...formData, capexAmount: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder={String(initiatives.find(i => i.id === formData.initiativeId)?.capex ?? 0)} className={inputClass} />)}
            {field('OpEx Override ($)', <input type="number" data-testid="rpti-opex-amount-input" value={formData.opexAmount ?? ''} onChange={e => setFormData({ ...formData, opexAmount: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder={String(initiatives.find(i => i.id === formData.initiativeId)?.opex ?? 0)} className={inputClass} />)}
          </div>
          {budgetWarning && (
            <p data-testid="rpti-budget-warning" className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              This initiative's RPTI rows now total {budgetWarning.capexOver ? `$${budgetWarning.capexSum.toLocaleString()} CapEx` : ''}{budgetWarning.capexOver && budgetWarning.opexOver ? ' / ' : ''}{budgetWarning.opexOver ? `$${budgetWarning.opexSum.toLocaleString()} OpEx` : ''}, above the initiative's own total.
            </p>
          )}

          {field('Remarks', <textarea data-testid="rpti-remarks-input" rows={2} value={formData.remarks ?? ''} onChange={e => setFormData({ ...formData, remarks: e.target.value })} className={inputClass} />)}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={cancelEdit} className="flex-1 py-2 px-4 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 text-sm font-medium">Cancel</button>
            <button type="button" onClick={handleSave} data-testid="save-rpti-detail-btn" className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm">Save</button>
          </div>
        </div>
      ) : rptiDetails.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-sm">No RPTI rows recorded yet.</p>
        </div>
      ) : (
        <div data-testid="rpti-detail-table" className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 text-left">No.</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-left">Dev Type</th>
                <th className="px-3 py-2 text-left">Developer</th>
                <th className="px-3 py-2 text-left">Quarter</th>
                <th className="px-3 py-2 text-left">CapEx</th>
                <th className="px-3 py-2 text-left">OpEx</th>
                <th className="px-3 py-2 text-left">Remarks</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rptiDetails.map((detail, index) => {
                const initiative = initiatives.find(i => i.id === detail.initiativeId);
                const { capexAmount, opexAmount } = resolveCost(detail, initiative);
                const quarter = detail.plannedImplementationQuarter
                  ?? suggestApplicationQuarter(detail, applicationSegments, applicationStatuses).quarter
                  ?? '—';
                return (
                  <tr key={detail.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">{index + 1}</td>
                    <td className="px-3 py-2 font-medium text-slate-800">{targetName(detail)}</td>
                    <td className="px-3 py-2">{detail.categoryCode}</td>
                    <td className="px-3 py-2 capitalize">{detail.developmentType}</td>
                    <td className="px-3 py-2">{detail.developer}</td>
                    <td className="px-3 py-2">{quarter}</td>
                    <td className="px-3 py-2">${capexAmount.toLocaleString()}</td>
                    <td className="px-3 py-2">${opexAmount.toLocaleString()}</td>
                    <td className="px-3 py-2 text-slate-500 max-w-[160px] truncate">{detail.remarks}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEdit(detail)} data-testid="edit-rpti-detail-btn" className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setConfirmDelete(detail)} data-testid="delete-rpti-detail-btn" className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmDelete !== null}
        title="Delete RPTI Row"
        message={confirmDelete ? `Remove the RPTI row for "${targetName(confirmDelete)}"? This cannot be undone.` : ''}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
