import { useRef, useState } from 'react';
import { TemplateId } from '../lib/workspaceTemplates';
import { FileSpreadsheet, Loader2, AlertCircle, ArchiveRestore, HardDriveDownload } from 'lucide-react';
import type { PortableWorkspace } from '../lib/workspaceBackup';
import { useBackupDownload } from '../lib/backupDownload';
import { BackupStatusNote, LastBackupStarted } from './BackupStatus';

export interface OnboardingImportRequest {
  lkptiFile: File;
  lkptiYear: number;
  rptiFile?: File;
  rptiYear?: number;
}

interface TemplatePickerModalProps {
  onSelect: (templateId: TemplateId, withDemoData: boolean) => void;
  /** Import the filed returns. Rejects with a message the user should see. */
  onImportReturns: (request: OnboardingImportRequest) => Promise<void>;
  /**
   * Restore a Selara backup instead of starting anew. Offered here because a
   * fresh browser profile — the case a backup exists for — opens on this picker.
   * Rejects with a message the user should see.
   */
  onRestoreBackup?: (file: File) => Promise<void>;
  /**
   * Offered when this browser holds History or decisions: a workspace with no
   * current records still opens on this picker, which covers the header's Backup.
   */
  backup?: { onPrepareBackup: () => Promise<PortableWorkspace>; versions: number; decisions: number };
  isReset?: boolean;
}

const CURRENT_YEAR = new Date().getFullYear();
const yearIsValid = (v: string) => /^\d{4}$/.test(v) && Number(v) >= 2000 && Number(v) <= CURRENT_YEAR + 10;

/**
 * The way into Selara: bring the returns you already file with OJK, or start empty.
 *
 * Two paths rather than a template gallery, because this is a tool for preparing
 * RPTI and LKPTI and the first screen should say so. Each return carries its own
 * reporting year — an inventory *as at* 2026 beside a plan *for* 2027 is the
 * normal pairing, so asking once would be wrong most of the time. Neither layout
 * carries a year, so neither can be inferred.
 */
export function TemplatePickerModal({ onSelect, onImportReturns, onRestoreBackup, backup, isReset = false }: TemplatePickerModalProps) {
  const lkptiInputRef = useRef<HTMLInputElement>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const backupDownload = useBackupDownload(backup?.onPrepareBackup ?? (async () => { throw new Error('Backup is not available here.'); }));
  const rptiInputRef = useRef<HTMLInputElement>(null);
  const [lkptiFile, setLkptiFile] = useState<File | null>(null);
  const [rptiFile, setRptiFile] = useState<File | null>(null);
  const [lkptiYear, setLkptiYear] = useState('');
  const [rptiYear, setRptiYear] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The RPTI half is optional, but half-supplied is a mistake worth catching
  // before anything is written.
  const rptiReady = !rptiFile || yearIsValid(rptiYear);
  const canImport = !!lkptiFile && yearIsValid(lkptiYear) && rptiReady && !busy;

  const runImport = async () => {
    if (!lkptiFile || !canImport) return;
    setBusy(true);
    setError(null);
    try {
      await onImportReturns({
        lkptiFile,
        lkptiYear: Number(lkptiYear),
        rptiFile: rptiFile ?? undefined,
        rptiYear: rptiFile ? Number(rptiYear) : undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The import could not be completed.');
    } finally {
      // Replacing an existing workspace opens a preview first; if that is
      // cancelled, the picker must be usable again.
      setBusy(false);
    }
  };

  const runRestore = async (file: File) => {
    if (!onRestoreBackup) return;
    setRestoring(true);
    setRestoreError(null);
    try {
      await onRestoreBackup(file);
    } catch (e) {
      setRestoreError(e instanceof Error ? e.message : 'The backup could not be restored.');
    } finally {
      setRestoring(false);
    }
  };

  const slot = (
    kind: 'lkpti' | 'rpti',
    title: string,
    subtitle: string,
    required: boolean,
    file: File | null,
    setFile: (f: File | null) => void,
    year: string,
    setYear: (y: string) => void,
    ref: React.RefObject<HTMLInputElement | null>,
  ) => (
    <div data-testid={`onboarding-${kind}-slot`} className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h4 className="font-semibold text-slate-800 text-sm">{title}</h4>
        <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${
          required ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'
        }`}>
          {required ? 'Required' : 'Optional'}
        </span>
      </div>
      <p className="text-xs text-slate-500 mb-3">{subtitle}</p>
      <input
        ref={ref}
        type="file"
        accept=".xlsx,.xls"
        data-testid={`onboarding-${kind}-file-input`}
        className="hidden"
        onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.currentTarget.value = ''; }}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          data-testid={`onboarding-${kind}-upload-btn`}
          onClick={() => ref.current?.click()}
          className="px-3 py-2 text-sm font-medium bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
        >
          <FileSpreadsheet size={14} />
          {file ? 'Change file' : 'Choose file'}
        </button>
        <input
          type="text"
          inputMode="numeric"
          placeholder="Year"
          aria-label={`${title} reporting year`}
          data-testid={`onboarding-${kind}-year`}
          value={year}
          onChange={(e) => setYear(e.target.value.trim())}
          className="w-24 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      {file && (
        <p data-testid={`onboarding-${kind}-filename`} className="text-xs text-slate-500 mt-2 truncate">{file.name}</p>
      )}
    </div>
  );

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
      data-testid="template-picker-modal"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-900">
            {isReset ? 'Clear data and start again' : 'Welcome to Selara'}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {isReset
              ? 'Choose how to start again. This will permanently replace all your current data.'
              : 'Prepare your OJK regulatory returns — RPTI (Format 3.1) and LKPTI (Format 3.2.6).'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
          <div data-testid="onboarding-path-returns" className="border border-slate-200 rounded-xl p-5 flex flex-col gap-3">
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Start from your filed returns</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Upload what you last filed with OJK. Nothing is retyped.
              </p>
            </div>

            {slot('lkpti', 'LKPTI — Daftar Aplikasi', 'The applications you run, as at 31 December of the reporting year.',
              true, lkptiFile, setLkptiFile, lkptiYear, setLkptiYear, lkptiInputRef)}
            {slot('rpti', 'RPTI — Rencana', 'Your development plan for the reporting year. Applications and infrastructure.',
              false, rptiFile, setRptiFile, rptiYear, setRptiYear, rptiInputRef)}

            {error && (
              <p data-testid="onboarding-error" className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-start gap-2">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </p>
            )}

            <button
              type="button"
              data-testid="onboarding-import-btn"
              disabled={!canImport}
              onClick={runImport}
              className="mt-auto px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-slate-200 disabled:text-slate-400 flex items-center justify-center gap-2"
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              {busy ? 'Importing…' : 'Import and review'}
            </button>
          </div>

          <div data-testid="onboarding-path-empty" className="border border-slate-200 rounded-xl p-5 flex flex-col gap-2">
            <h3 className="font-semibold text-slate-800 text-sm">Start empty</h3>
            <p className="text-sm text-slate-500 flex-1 leading-relaxed">
              Build your portfolio from scratch. The standard OJK technology areas can be added
              from the Visualiser at any time.
            </p>
            <button
              data-testid="template-start-blank-btn"
              onClick={() => onSelect('blank', false)}
              className="mt-2 px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              Start blank
            </button>
            <button
              data-testid="template-start-demo-btn"
              onClick={() => onSelect('rpti', true)}
              className="px-4 py-2 text-sm font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg transition-colors"
            >
              Explore with demo data
            </button>
          </div>
        </div>

        {onRestoreBackup && (
          <div data-testid="onboarding-path-restore" className="mx-6 mb-6 -mt-2 rounded-xl border border-slate-200 bg-slate-50/60 p-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex-1">
              <h3 className="font-semibold text-slate-800 text-sm">{backup ? 'Back up or restore' : 'Restore a backup'}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                {backup && (
                  <>
                    This browser still holds {backup.versions} saved version(s) and {backup.decisions} decision(s).
                    Starting again removes them — download a backup first if you might need them.{' '}
                  </>
                )}
                Have a Selara backup file? Restore it, History and decisions included. You'll see what it contains before anything is replaced.
              </p>
            </div>
            {backup && (
              <button
                type="button"
                data-testid="template-backup-download"
                disabled={backupDownload.busy}
                onClick={backupDownload.run}
                className="shrink-0 px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {backupDownload.busy ? <Loader2 size={14} className="animate-spin" /> : <HardDriveDownload size={14} />}
                Download backup
              </button>
            )}
            <input
              ref={restoreInputRef}
              type="file"
              accept=".xlsx"
              data-testid="template-restore-backup-input"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.currentTarget.value = '';
                if (file) void runRestore(file);
              }}
            />
            <button
              type="button"
              data-testid="template-restore-backup-btn"
              disabled={restoring}
              onClick={() => restoreInputRef.current?.click()}
              className="shrink-0 px-4 py-2 text-sm font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {restoring ? <Loader2 size={14} className="animate-spin" /> : <ArchiveRestore size={14} />}
              Choose backup file
            </button>
            {backup && (backupDownload.status || backupDownload.lastStarted) && (
              <div className="basis-full space-y-1">
                {backupDownload.status && <BackupStatusNote status={backupDownload.status} testId="template-backup-status" />}
                <LastBackupStarted value={backupDownload.lastStarted} testId="template-backup-last-started" />
              </div>
            )}
            {restoreError && (
              <p data-testid="template-restore-error" className="basis-full text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-start gap-2">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{restoreError}</span>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
