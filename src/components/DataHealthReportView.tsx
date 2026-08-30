import React, { useState } from 'react';
import { computeDataHealth, DataHealthInput, HealthIssue, HealthIssueLocation, HealthSeverity } from '../lib/dataHealth';
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

  const issues = computeDataHealth(healthInput);
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const visible = severityFilter === 'all' ? issues : issues.filter(i => i.severity === severityFilter);

  return (
    <div data-testid="data-health-report-view" className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-sm text-slate-500">
          Dangling references and report-generation gaps across the whole workspace. Click an issue to jump to where it can be fixed.
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
      </div>

      {issues.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-sm">No data-health issues found — the workspace is clean.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-sm">No {severityFilter}s to show.</p>
        </div>
      ) : (
        <ul data-testid="data-health-issue-list" className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white overflow-hidden">
          {visible.map(issue => {
            const style = SEVERITY_STYLES[issue.severity];
            return (
              <li key={issue.id}>
                <button
                  data-testid={`data-health-issue-${issue.id}`}
                  onClick={() => onNavigate(issue.location, issue.entityName)}
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
