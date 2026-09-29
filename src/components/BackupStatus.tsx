import type { BackupStatus } from '../lib/backupDownload';

export function BackupStatusNote({ status, testId }: { status: BackupStatus; testId: string }) {
  return (
    <div
      data-testid={testId}
      data-outcome={status.outcome}
      role="status"
      className={`rounded-lg border p-2.5 text-xs ${
        status.outcome === 'failed' ? 'border-red-200 bg-red-50 text-red-800'
          : status.outcome === 'started-unrecorded' ? 'border-amber-200 bg-amber-50 text-amber-900'
            : 'border-emerald-200 bg-emerald-50 text-emerald-900'
      }`}
    >
      <p>{status.message}</p>
      {status.notices && status.notices.length > 0 && (
        <ul className="mt-1.5 max-h-24 overflow-y-auto list-disc pl-4 space-y-0.5">
          {status.notices.map(notice => <li key={notice}>{notice}</li>)}
        </ul>
      )}
    </div>
  );
}

export function LastBackupStarted({ value, testId }: { value: string | null; testId: string }) {
  return (
    <p data-testid={testId} className="text-xs text-slate-500">
      {value
        ? `Last backup download started ${new Date(value).toLocaleString()}. That records that a download began, not proof the file was saved.`
        : 'No backup download has been started in this browser.'}
    </p>
  );
}
