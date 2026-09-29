import { RefreshCw, TriangleAlert } from 'lucide-react';
import type { ReplacementRow } from '../lib/workspaceState';

interface ReplacementSummaryProps {
  rows: ReplacementRow[];
  /** What happens to History, the decision log and settings — stated even when nothing changes. */
  effects: string[];
  /** Compatibility limits, repairs and preserved oddities the planner should know about first. */
  notices?: string[];
  /** The workspace changed after this preview was prepared; the counts may be out of date. */
  stale?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  error?: string | null;
}

/**
 * What a whole-workspace replacement will do, shown before it is confirmed
 * (specs/005-workspace-recovery, contracts/replacement-routes.md). Shared by every
 * route so Restore Backup, Import, Open shared, templates, onboarding, share links
 * and History restore describe their effects the same way.
 */
export function ReplacementSummary({ rows, effects, notices = [], stale = false, onRefresh, refreshing = false, error }: ReplacementSummaryProps) {
  return (
    <div className="mt-3 space-y-3 text-left">
      {stale && (
        <div data-testid="replacement-stale" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            The workspace changed after this preview was prepared, possibly in another tab. Review the updated effects before confirming.
          </div>
          {onRefresh && (
            <button
              type="button"
              data-testid="replacement-refresh"
              onClick={onRefresh}
              disabled={refreshing}
              className="flex shrink-0 items-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-1 font-medium hover:bg-amber-100 disabled:opacity-50"
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          )}
        </div>
      )}

      {rows.length > 0 ? (
        <table className="w-full text-sm" data-testid="replacement-counts">
          <thead>
            <tr className="text-xs text-slate-400">
              <th className="text-left font-medium pb-1"></th>
              <th className="text-right font-medium pb-1">Current</th>
              <th className="text-right font-medium pb-1">Incoming</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            {rows.map(row => (
              <tr key={row.key} data-testid={`replacement-count-${row.key}`}>
                <td className="py-0.5">{row.label}</td>
                <td className="py-0.5 text-right tabular-nums" data-testid="replacement-current">{row.current}</td>
                <td className="py-0.5 text-right tabular-nums" data-testid="replacement-incoming">{row.incoming}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p data-testid="replacement-counts" className="text-sm text-slate-500">No records before or after.</p>
      )}

      <ul data-testid="replacement-effects" className="space-y-0.5 text-xs text-slate-600">
        {effects.map(effect => <li key={effect}>{effect}</li>)}
      </ul>

      {notices.length > 0 && (
        <ul data-testid="replacement-notices" className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
          {notices.map(notice => <li key={notice}>{notice}</li>)}
        </ul>
      )}

      {error && (
        <p data-testid="replacement-error" role="alert" className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
