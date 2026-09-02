import React, { useState } from 'react';
import { computeDataHealth, DataHealthInput, HealthIssue, HealthIssueLocation, HealthPhase, HealthSeverity } from '../lib/dataHealth';
import { AlertTriangle, AlertCircle } from 'lucide-react';

interface DataHealthReportViewProps extends DataHealthInput {
  onNavigate: (location: HealthIssueLocation, entityName: string) => void;
}

const SEVERITY_STYLES: Record<HealthSeverity, { badge: string; icon: React.ReactNode; label: string }> = {
  error: { badge: 'bg-red-100 text-red-700', icon: <AlertCircle size={14} />, label: 'Error' },
  warning: { badge: 'bg-amber-100 text-amber-700', icon: <AlertTriangle size={14} />, label: 'Warning' },
};

export function DataHealthReportView(props: DataHealthReportViewProps) {
  const { onNavigate, ...healthInput } = props;
  const [severityFilter, setSeverityFilter] = useState<HealthSeverity | 'all'>('all');
  const [phaseFilter, setPhaseFilter] = useState<HealthPhase | 'all'>('all');

  const issues = computeDataHealth(healthInput);
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const validityCount = issues.filter(i => i.phase === 'validity').length;
  const completenessCount = issues.filter(i => i.phase === 'completeness').length;
  const validityErrors = issues.filter(i => i.phase === 'validity' && i.severity === 'error').length;
  const validityWarnings = validityCount - validityErrors;

  // Severity and phase are independent axes (spec § Phase 2 §1/§7), so the two filters
  // compose rather than collapsing into one list.
  const visible = issues.filter(i =>
    (severityFilter === 'all' || i.severity === severityFilter)
    && (phaseFilter === 'all' || i.phase === phaseFilter),
  );

  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const verdict =
    issues.length === 0
      ? 'Ready to file — no data-health issues found.'
      : validityErrors > 0
        ? `Not ready to file — ${plural(validityErrors, 'validity error')}, ${plural(completenessCount, 'completeness gap')}.`
        : `No validity errors — ${plural(completenessCount, 'completeness gap')} and ${plural(validityWarnings, 'validity warning')} left to review.`;
  const verdictStyle =
    issues.length === 0 ? 'bg-green-50 text-green-800 border-green-200'
      : validityErrors > 0 ? 'bg-red-50 text-red-800 border-red-200'
        : 'bg-amber-50 text-amber-800 border-amber-200';

  return (
    <div data-testid="data-health-report-view" className="space-y-4">
      <p data-testid="data-health-verdict" className={`text-sm font-medium px-4 py-2.5 rounded-xl border ${verdictStyle}`}>
        {verdict}
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-sm text-slate-500">
          Dangling references, report-generation gaps, and values that would be rejected at filing time. Click an issue to jump to where it can be fixed.
        </p>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 text-xs">
          {(['all', 'error', 'warning'] as const).map(f => (
            <button
              key={f}
              data-testid={`data-health-filter-${f}`}
              onClick={() => setSeverityFilter(f)}
              aria-pressed={severityFilter === f}
              className={`px-2.5 py-1 rounded-full font-medium transition-colors ${
                severityFilter === f ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f === 'all' ? `All (${issues.length})` : f === 'error' ? `Errors (${errorCount})` : `Warnings (${warningCount})`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          {(['all', 'validity', 'completeness'] as const).map(f => (
            <button
              key={f}
              data-testid={`data-health-phase-filter-${f}`}
              onClick={() => setPhaseFilter(f)}
              aria-pressed={phaseFilter === f}
              className={`px-2.5 py-1 rounded-full font-medium transition-colors ${
                phaseFilter === f ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f === 'all' ? 'Both phases' : f === 'validity' ? `Validity (${validityCount})` : `Completeness (${completenessCount})`}
            </button>
          ))}
        </div>
      </div>

      {issues.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-sm">No data-health issues found — the workspace is clean.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-sm">No issues match the current filters.</p>
        </div>
      ) : (
        <ul data-testid="data-health-issue-list" className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white overflow-hidden">
          {visible.map(issue => {
            const style = SEVERITY_STYLES[issue.severity];
            return (
              <li key={issue.id}>
                <button
                  data-testid={`data-health-issue-${issue.id}`}
                  onClick={() => onNavigate(issue.location, issue.entityType === 'Workspace' ? '' : issue.entityName)}
                  className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors"
                >
                  <span className={`mt-0.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${style.badge}`}>
                    {style.icon}
                    {style.label}
                  </span>
                  <span className="text-sm text-slate-700 flex-1">{issue.message}</span>
                  <span className="text-xs text-slate-400 flex-shrink-0">{issue.entityType}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
