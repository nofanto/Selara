import React, { useState } from 'react';
import type { RptiDetail, RptiCategoryCode } from '../types';
import { INFRASTRUCTURE_CODES, RPTI_CATEGORY_LABELS } from '../lib/rpti';
import { repairOptions, unresolvedRowRepairDraft, type ConfirmedUnresolvedRowValues, type UnresolvedRowRepairRequest } from '../lib/unresolvedRowRepair';
import { useFocusTrap } from '../lib/useFocusTrap';

interface Props {
  row: RptiDetail;
  initiatives: Parameters<typeof unresolvedRowRepairDraft>[1]['initiatives'];
  onCancel: () => void;
  onConfirm: (request: UnresolvedRowRepairRequest) => Promise<{ ok: true } | { ok: false; reason: string }>;
}

const SOURCE_LABELS = {
  'stored-row': 'From the filed row',
  'initiative-name': 'From the initiative name',
  'initiative-start': 'From the initiative start date',
  'initiative-budget': "Initiative's current budget — check against the filed return",
  'needs-input': 'Required: enter the provider name',
};

// B creates an application, so only application codes are offered (apply rejects the rest too).
const APPLICATION_CATEGORY_OPTIONS = (Object.keys(RPTI_CATEGORY_LABELS) as RptiCategoryCode[])
  .filter(code => !INFRASTRUCTURE_CODES.has(code))
  .map(code => ({ value: code, label: `${code} — ${RPTI_CATEGORY_LABELS[code]}` }));
const RELATED_PARTY_OPTIONS = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'n/a', label: 'N/A' }];
const testId = (key: string) => `repair-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`;

/** One repair surface for Data Health and the pre-export gate. Confirm writes through App once. */
export function UnresolvedRowRepairDialog({ row, initiatives, onCancel, onConfirm }: Props) {
  const draft = unresolvedRowRepairDraft(row, { initiatives });
  const [option, setOption] = useState<'create' | 'existing' | null>(null);
  const [values, setValues] = useState<ConfirmedUnresolvedRowValues>(() => ({
    name: draft.name.value, filedYear: draft.filedYear.value, quarter: draft.quarter.value,
    categoryCode: draft.categoryCode.value, developer: draft.developer.value,
    providerName: draft.providerName.value, ppjtiRelatedParty: draft.ppjtiRelatedParty.value,
    dcCity: draft.dcCity.value, dcCountry: draft.dcCountry.value,
    drCity: draft.drCity.value, drCountry: draft.drCountry.value,
    remarks: draft.remarks.value, capex: draft.capex.value, opex: draft.opex.value,
  }));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const panelRef = useFocusTrap(true, onCancel);
  const set = <K extends keyof ConfirmedUnresolvedRowValues>(key: K, value: ConfirmedUnresolvedRowValues[K]) =>
    setValues(previous => ({ ...previous, [key]: value }));
  const field = (key: keyof ConfirmedUnresolvedRowValues, label: string, source: keyof typeof SOURCE_LABELS,
    readOnly = false, kind: 'text' | 'number' = 'text') => (
    <label className="block text-sm text-slate-700" key={key}>
      <span className="font-medium">{label}</span>
      <span data-testid={`${testId(key)}-source`}
        className="block text-xs text-slate-500">{SOURCE_LABELS[source]}</span>
      <input
        data-testid={testId(key)}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 read-only:bg-slate-50"
        type={kind} readOnly={readOnly} required={key === 'providerName'}
        value={typeof values[key] === 'number' && Number.isNaN(values[key]) ? '' : values[key] ?? ''}
        // An emptied number box is "no value", not zero: Number('') is 0, and filing a zero cost
        // is the #51 corruption. NaN is refused by applyUnresolvedRowRepair with a reason.
        onChange={event => set(key, (kind === 'number'
          ? (event.target.value === '' ? Number.NaN : Number(event.target.value))
          : event.target.value) as never)}
      />
    </label>
  );
  // A constrained value is a choice, not free text: the filed row's value is always one of these.
  const choice = (key: 'categoryCode' | 'ppjtiRelatedParty', label: string, source: keyof typeof SOURCE_LABELS,
    options: { value: string; label: string }[]) => (
    <label className="block text-sm text-slate-700" key={key}>
      <span className="font-medium">{label}</span>
      <span data-testid={`${testId(key)}-source`} className="block text-xs text-slate-500">{SOURCE_LABELS[source]}</span>
      <select data-testid={testId(key)} value={values[key] ?? ''}
        onChange={event => set(key, (event.target.value || undefined) as never)}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
  const confirm = async () => {
    if (option !== 'create') return;
    setBusy(true);
    const result = await onConfirm({ rowId: row.id, option, confirmed: values });
    setBusy(false);
    if (!result.ok) setReason('reason' in result ? result.reason : 'Could not apply repair.');
  };

  return (
    <div data-testid="unresolved-row-repair-dialog" className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 p-4"
      onClick={event => { if (event.target === event.currentTarget) onCancel(); }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Repair unresolved RPTI row"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-slate-800">Repair unresolved RPTI row</h2>
        <p className="mt-1 text-sm text-slate-600">Check the values from the filed return before adding the missing inventory entry.</p>
        <div className="mt-4 space-y-2">
          {repairOptions(row).includes('create') && (
            <button data-testid="repair-option-create" type="button" onClick={() => setOption('create')}
              aria-pressed={option === 'create'} className="w-full rounded-lg border border-slate-300 px-4 py-3 text-left text-sm hover:bg-slate-50 aria-pressed:border-indigo-500">
              The bank runs it, but the inventory doesn’t list it
            </button>
          )}
        </div>
        {option === 'create' && (
          <div className="mt-5 grid grid-cols-2 gap-4">
            {field('name', 'Application name', draft.name.source)}
            {draft.name.check && <p className="col-span-2 text-sm text-amber-700">Check this name against the filed return; the initiative was renamed.</p>}
            {choice('categoryCode', 'Category code', draft.categoryCode.source, APPLICATION_CATEGORY_OPTIONS)}
            {field('quarter', 'Filed quarter', draft.quarter.source, true)}
            {field('filedYear', 'Filed year', draft.filedYear.source, true)}
            {field('developer', 'Developer classification', draft.developer.source, true)}
            {values.developer === 'PPJTI' && field('providerName', 'Provider name', draft.providerName.source)}
            {choice('ppjtiRelatedParty', 'PPJTI related party', draft.ppjtiRelatedParty.source, RELATED_PARTY_OPTIONS)}
            {field('dcCity', 'DC city', draft.dcCity.source)}
            {field('dcCountry', 'DC country', draft.dcCountry.source)}
            {field('drCity', 'DR city', draft.drCity.source)}
            {field('drCountry', 'DR country', draft.drCountry.source)}
            {field('remarks', 'Keterangan', draft.remarks.source)}
            {field('capex', 'CapEx', draft.capex.source, false, 'number')}
            {field('opex', 'OpEx', draft.opex.source, false, 'number')}
            <p data-testid="repair-prior-note" className="col-span-2 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-800">
              This adds prior live history and lists the application in the inventory from {values.filedYear - 1}.
            </p>
          </div>
        )}
        {reason && <p data-testid="repair-error" role="alert" className="mt-3 text-sm text-red-700">{reason}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button data-testid="repair-cancel" type="button" onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button>
          <button data-testid="repair-confirm" type="button" disabled={option !== 'create' || busy} onClick={confirm}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50">Confirm repair</button>
        </div>
      </div>
    </div>
  );
}
