import { useEffect, useRef, useState } from 'react';
import { ArchiveRestore, HardDriveDownload, Loader2 } from 'lucide-react';
import type { PortableWorkspace } from '../lib/workspaceBackup';
import { useBackupDownload } from '../lib/backupDownload';
import { BackupStatusNote, LastBackupStarted } from './BackupStatus';

interface BackupControlsProps {
  /** The coherent saved workspace, after pending saves — rejects if on-screen work isn't saved. */
  onPrepareBackup: () => Promise<PortableWorkspace>;
  /** Restore Backup: validates the file and opens its preview; rejects with a message to show. */
  onRestoreBackup: (file: File) => Promise<void>;
}

/**
 * Backup and Restore Backup (specs/005-workspace-recovery, US1/US3). Kept apart
 * from the spreadsheet Export/Import and the PDF/PNG exports on purpose: those
 * are interchange and pictures; this is the whole workspace, History included,
 * in a form Restore can prove complete.
 */
export function BackupControls({ onPrepareBackup, onRestoreBackup }: BackupControlsProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  // Where the panel opens: the header scrolls horizontally, which would clip an absolute panel.
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const backup = useBackupDownload(onPrepareBackup);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const handleRestoreFile = async (file: File) => {
    setRestoreError(null);
    try {
      await onRestoreBackup(file);
    } catch (error) {
      setRestoreError(error instanceof Error ? error.message : 'The backup could not be restored.');
    }
  };

  return (
    <div className="relative shrink-0" ref={panelRef}>
      <button
        data-testid="backup-menu-button"
        onClick={() => {
          setAnchor(panelRef.current?.getBoundingClientRect() ?? null);
          setOpen(o => !o);
        }}
        aria-expanded={open}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-medium text-emerald-800 hover:bg-emerald-100 transition-colors"
        title="Back up or restore the whole workspace, History included"
      >
        <HardDriveDownload size={14} />
        Backup
      </button>
      {open && anchor && (() => {
        const width = Math.min(320, window.innerWidth - 16);
        const left = Math.max(8, Math.min(anchor.right - width, window.innerWidth - width - 8));
        return (
        <div
          data-testid="backup-panel"
          style={{ top: anchor.bottom + 8, left, width }}
          className="fixed max-h-[80vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-lg z-50 text-left space-y-3"
        >
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Workspace backup</h3>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              One Excel file with everything in this workspace: records, stored RPTI and LKPTI rows,
              History (saved versions), the decision log and settings. Keep it outside this browser —
              History saved here is lost if this browser's data is cleared.
            </p>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              A started download is not proof the file was saved. Check that it arrived where you keep backups.
            </p>
          </div>
          <button
            data-testid="backup-download"
            onClick={backup.run}
            disabled={backup.busy}
            className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
          >
            {backup.busy ? <Loader2 size={14} className="animate-spin" /> : <HardDriveDownload size={14} />}
            Download backup
          </button>
          {backup.status && <BackupStatusNote status={backup.status} testId="backup-status" />}
          <LastBackupStarted value={backup.lastStarted} testId="backup-last-started" />
          <div className="border-t border-slate-100 pt-3">
            <input
              ref={restoreInputRef}
              type="file"
              accept=".xlsx"
              data-testid="backup-restore-input"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.currentTarget.value = '';
                if (file) void handleRestoreFile(file);
              }}
            />
            <button
              data-testid="backup-restore"
              onClick={() => restoreInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors"
            >
              <ArchiveRestore size={14} />
              Restore from backup…
            </button>
            {restoreError && (
              <p data-testid="backup-restore-error" role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
                {restoreError}
              </p>
            )}
            <p className="mt-1.5 text-xs text-slate-400">
              Shows what the backup contains, and what it replaces, before anything changes.
              PDF, PNG and report exports are not backups.
            </p>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
