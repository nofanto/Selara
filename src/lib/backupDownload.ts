import { useState } from 'react';
import { backupFileName, BackupGenerationError, createBackup, type PortableWorkspace } from './workspaceBackup';

/**
 * When a backup download was last *started* in this browser (FR-011). Local
 * operational metadata: not part of any workspace or backup, and never evidence
 * that the file was saved — a browser can cancel or block a download after it
 * starts, and Selara cannot see that.
 */
export const LAST_BACKUP_STARTED_KEY = 'selara-last-backup-started';

const readLastBackupStarted = (): string | null => {
  try {
    const value = localStorage.getItem(LAST_BACKUP_STARTED_KEY);
    return value && !Number.isNaN(Date.parse(value)) ? value : null;
  } catch {
    return null;
  }
};

/** Starts the browser download. Throws if it can't even be started. */
const startDownload = (bytes: Uint8Array, fileName: string) => {
  const blob = new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

export type BackupStatus = { outcome: 'started' | 'started-unrecorded' | 'failed'; message: string; notices?: string[] };

/**
 * The Backup action, shared by the header panel and the template picker (which a
 * workspace holding only History or decisions opens on, and would otherwise hide
 * the header behind).
 *
 * A verified file first, then the download, then the timestamp — and each failure
 * is reported as what it is (FR-018). A failed generation or download leaves the
 * previous timestamp alone; a started download whose time can't be stored says so
 * rather than pretending either way.
 */
export function useBackupDownload(prepare: () => Promise<PortableWorkspace>) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [lastStarted, setLastStarted] = useState<string | null>(readLastBackupStarted);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      let file: { bytes: Uint8Array; notices: string[] };
      try {
        file = createBackup(await prepare());
      } catch (error) {
        const detail = error instanceof BackupGenerationError
          ? `${error.problems.slice(0, 3).join(' ')}${error.problems.length > 3 ? ` (and ${error.problems.length - 3} more)` : ''}`
          : error instanceof Error ? error.message : String(error);
        setStatus({ outcome: 'failed', message: `Backup was not created, and nothing was downloaded. ${detail}` });
        return;
      }
      const fileName = backupFileName();
      try {
        startDownload(file.bytes, fileName);
      } catch (error) {
        setStatus({ outcome: 'failed', message: `The download could not be started (${error instanceof Error ? error.message : String(error)}). No backup was saved.` });
        return;
      }
      const startedAt = new Date().toISOString();
      try {
        localStorage.setItem(LAST_BACKUP_STARTED_KEY, startedAt);
      } catch {
        setStatus({
          outcome: 'started-unrecorded',
          message: `Download started, but its time could not be remembered in this browser. Check that ${fileName} was saved somewhere outside this browser.`,
          notices: file.notices,
        });
        return;
      }
      setLastStarted(startedAt);
      setStatus({
        outcome: 'started',
        message: `Download started: ${fileName}. Check that it was saved somewhere outside this browser — Selara can't confirm that.`,
        notices: file.notices,
      });
    } finally {
      setBusy(false);
    }
  };

  return { run, busy, status, lastStarted };
}

