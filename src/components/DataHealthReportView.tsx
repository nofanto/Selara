import React, { useState } from 'react';
import {
  checkOf, computeDataHealth, DataHealthInput, HealthIssue, HealthIssueLocation,
  HealthPhase, HealthReport, HealthSeverity,
} from '../lib/dataHealth';
import { AlertTriangle, AlertCircle, ChevronRight } from 'lucide-react';

interface DataHealthReportViewProps extends DataHealthInput {
  onNavigate: (location: HealthIssueLocation, entityName: string) => void;
  onRepairUnresolvedRow?: (rowId: string) => void;
  onExtendImportPriorPhase?: (segmentId: string) => void;
}

const SEVERITY_STYLES: Record<HealthSeverity, { badge: string; icon: React.ReactNode; label: string }> = {
  error: { badge: 'bg-red-100 text-red-700', icon: <AlertCircle size={14} />, label: 'Error' },
  warning: { badge: 'bg-amber-100 text-amber-700', icon: <AlertTriangle size={14} />, label: 'Warning' },
};

const REPORT_BADGE: Record<string, { label: string; className: string }> = {
  'rpti': { label: 'RPTI', className: 'bg-indigo-100 text-indigo-700' },
  'lkpti': { label: 'LKPTI', className: 'bg-teal-100 text-teal-700' },
  'rpti,lkpti': { label: 'Both', className: 'bg-violet-100 text-violet-700' },
  '': { label: 'Neither', className: 'bg-slate-100 text-slate-500' },
};

/**
 * One row per kind of problem, not per affected record.
 *
 * A flat list is fine at the 26 issues a sample workspace produces and unusable at
 * the 1,990 a 300-application one does — where those 1,990 rows carry only nine
 * distinct kinds between them. Grouping is what makes the volume legible; the
 * report filter alone does not, since selecting RPTI still leaves ~1,330.
 */
interface IssueGroup {
  check: string;
  issues: HealthIssue[];
  severity: HealthSeverity;
  reports: HealthReport[];
  summary: string;
}

function groupByCheck(issues: HealthIssue[]): IssueGroup[] {
  const groups = new Map<string, IssueGroup>();
  for (const issue of issues) {
    const check = checkOf(issue.id);
    const existing = groups.get(check);
    if (existing) {
      existing.issues.push(issue);
      // An error anywhere in the group makes the group an error.
      if (issue.severity === 'error') existing.severity = 'error';
    } else {
      groups.set(check, {
        check, issues: [issue], severity: issue.severity, reports: issue.reports,
        summary: summarise(check),
      });
    }
  }
  // Errors first, then by how many records each affects: the two things that decide
  // what a person should look at first.
  return [...groups.values()].sort((a, b) =>
    (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1) || b.issues.length - a.issues.length,
  );
}

/**
 * A group heading names the problem once, where an individual message names the
 * record. Falls back to the check id so a newly added check is still readable,
 * rather than rendering blank.
 */
function summarise(check: string): string {
  const SUMMARIES: Record<string, string> = {
    'initiative-rpti-multi-target': 'Initiatives with an ambiguous RPTI target',
    'initiative-rpti-no-target': 'Initiatives with no resolvable RPTI target',
    'rpti-asset-target': 'RPTI rows targeting a bare Asset',
    'rpti-incomplete': 'RPTI rows missing a manual-only field',
    'rpti-initiative': 'RPTI rows pointing at a missing Initiative',
    'rpti-segment': 'RPTI rows pointing at a missing lifecycle segment',
    'rpti-target': 'RPTI rows pointing at a missing target',
    'lkpti-incomplete': 'LKPTI rows missing a manual-only field',
    'lkpti-target': 'LKPTI rows pointing at a missing Deliverable',
    'lkpti-golive-future': 'LKPTI go-live dates in the future — OJK rule 5.3 rejects these',
    'lkpti-golive-invalid': 'LKPTI go-live dates that are not a real date',
    'lkpti-too-long': 'LKPTI values longer than the schema allows',
    'lkpti-untidy-text': 'LKPTI values with line breaks or stray whitespace',
    'lkpti-duplicate-name': 'Applications sharing a name',
    'deliverable-no-segments': 'Deliverables with no lifecycle segments — invisible to both returns',
    'deliverable-no-live-segment': 'Deliverables with no live segment — excluded from LKPTI',
    'deliverable-no-initiative-segment': 'Deliverables whose segments have no Initiative — cannot reach the RPTI',
    'deliverable-no-category': 'Deliverables with no resolvable regulatory category',
    'deliverable-no-developer': 'Deliverables with no developer set',
    'deliverable-no-location': 'Deliverables missing a DC or DR location',
    'deliverable-no-description': 'Deliverables with no description',
    'rpti-import-prior-phase-gap': 'Imported prior phases that leave applications out of inventory years',
    'initiative-no-owner': 'Initiatives with no owner assigned',
    'workspace-currency-not-idr': 'Workspace currency is not IDR',
    'asset-category': 'Assets pointing at a missing Asset Category',
    'deliverable-asset': 'Deliverables pointing at a missing Asset',
    'segment-deliverable': 'Segments pointing at a missing Deliverable',
    'segment-initiative': 'Segments pointing at a missing Initiative',
    'segment-status': 'Segments with a status that no longer exists',
    'initiative-asset': 'Initiatives pointing at a missing Asset',
    'initiative-deliverable': 'Initiatives pointing at a missing Deliverable',
    'initiative-programme': 'Initiatives pointing at a missing Programme',
    'initiative-strategy': 'Initiatives pointing at a missing Strategy',
    'initiative-owner': 'Initiatives whose owner no longer exists',
    'initiative-resource': 'Initiatives assigned a Resource that no longer exists',
    'dependency-source': 'Dependencies whose source no longer exists',
    'dependency-target': 'Dependencies whose target no longer exists',
    'milestone-asset': 'Milestones pointing at a missing Asset',
    'decision-linked': 'Decisions linked to something that no longer exists',
    'decision-superseded-by': 'Decisions superseded by one that no longer exists',
  };
  return SUMMARIES[check] ?? check;
}

export function DataHealthReportView(props: DataHealthReportViewProps) {
  const { onNavigate, onRepairUnresolvedRow, onExtendImportPriorPhase, ...healthInput } = props;
  const [severityFilter, setSeverityFilter] = useState<HealthSeverity | 'all'>('all');
  const [phaseFilter, setPhaseFilter] = useState<HealthPhase | 'all'>('all');
  const [reportFilter, setReportFilter] = useState<HealthReport | 'all' | 'none'>('all');
  // Explicit overrides rather than a set of open groups, so the default can depend
  // on the group: errors open, warnings closed. An error blocks filing and there are
  // few of them — one in a sample workspace, thirty in a 300-application one — so
  // hiding them behind a click buries the only thing that must be dealt with.
  const [openOverrides, setOpenOverrides] = useState<Map<string, boolean>>(new Map());
  const isGroupOpen = (g: IssueGroup) => openOverrides.get(g.check) ?? (g.severity === 'error');

  const issues = computeDataHealth(healthInput);
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const validityCount = issues.filter(i => i.phase === 'validity').length;
  const completenessCount = issues.filter(i => i.phase === 'completeness').length;
  const validityErrors = issues.filter(i => i.phase === 'validity' && i.severity === 'error').length;
  const validityWarnings = validityCount - validityErrors;

  // An issue affecting both returns belongs under each of them: someone preparing the
  // RPTI needs to see a missing developer, even though it also shows under LKPTI.
  const inReport = (i: HealthIssue, f: typeof reportFilter) =>
    f === 'all' ? true : f === 'none' ? i.reports.length === 0 : i.reports.includes(f);
  const rptiCount = issues.filter(i => inReport(i, 'rpti')).length;
  const lkptiCount = issues.filter(i => inReport(i, 'lkpti')).length;
  const neitherCount = issues.filter(i => inReport(i, 'none')).length;

  // Severity, phase and report are independent axes, so the filters compose.
  const visible = issues.filter(i =>
    (severityFilter === 'all' || i.severity === severityFilter)
    && (phaseFilter === 'all' || i.phase === phaseFilter)
    && inReport(i, reportFilter),
  );
  const groups = groupByCheck(visible);

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

  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-full font-medium transition-colors ${
      active ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
    }`;

  const toggle = (g: IssueGroup) => setOpenOverrides(prev => {
    const next = new Map(prev);
    next.set(g.check, !isGroupOpen(g));
    return next;
  });

  return (
    <div data-testid="data-health-report-view" className="space-y-4">
      <p data-testid="data-health-verdict" className={`text-sm font-medium px-4 py-2.5 rounded-xl border ${verdictStyle}`}>
        {verdict}
      </p>

      {/* Which return you are preparing is the primary axis: it is the task, where
          severity and phase are properties of an individual finding. */}
      <div className="flex items-center gap-1.5 text-xs flex-wrap" role="group" aria-label="Filter by report">
        {([
          ['all', `Everything (${issues.length})`],
          ['rpti', `RPTI (${rptiCount})`],
          ['lkpti', `LKPTI (${lkptiCount})`],
          ['none', `Affects neither (${neitherCount})`],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            data-testid={`data-health-report-filter-${value}`}
            onClick={() => setReportFilter(value)}
            aria-pressed={reportFilter === value}
            className={chip(reportFilter === value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-sm text-slate-500">
          Dangling references, report-generation gaps, and values that would be rejected at filing time. Expand a row to see the records, and click one to jump to where it can be fixed.
        </p>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 text-xs">
          {(['all', 'error', 'warning'] as const).map(f => (
            <button
              key={f}
              data-testid={`data-health-filter-${f}`}
              onClick={() => setSeverityFilter(f)}
              aria-pressed={severityFilter === f}
              className={chip(severityFilter === f)}
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
              className={chip(phaseFilter === f)}
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
      ) : groups.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-sm">No issues match the current filters.</p>
        </div>
      ) : (
        <ul data-testid="data-health-issue-list" className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white overflow-hidden">
          {groups.map(group => {
            const style = SEVERITY_STYLES[group.severity];
            const badge = REPORT_BADGE[group.reports.join(',')] ?? REPORT_BADGE[''];
            const isOpen = isGroupOpen(group);
            return (
              <li key={group.check}>
                <button
                  data-testid={`data-health-group-${group.check}`}
                  onClick={() => toggle(group)}
                  aria-expanded={isOpen}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                >
                  <ChevronRight
                    size={14}
                    className={`text-slate-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                  />
                  <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${style.badge}`}>
                    {style.icon}
                    {style.label}
                  </span>
                  <span data-testid={`data-health-group-count-${group.check}`} className="text-sm font-semibold text-slate-800 tabular-nums w-12 text-right flex-shrink-0">
                    {group.issues.length}
                  </span>
                  <span className="text-sm text-slate-700 flex-1">{group.summary}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase flex-shrink-0 ${badge.className}`}>
                    {badge.label}
                  </span>
                </button>

                {isOpen && (
                  <ul data-testid={`data-health-group-items-${group.check}`} className="bg-slate-50/60 border-t border-slate-100 divide-y divide-slate-100">
                    {group.issues.map(issue => {
                      // Hoisted so the narrowing survives into the button callbacks: the union
                      // now has two action kinds, and TS cannot narrow `issue.action` inside them.
                      const action = issue.action;
                      return (
                        <li key={issue.id}>
                          <button
                            data-testid={`data-health-issue-${issue.id}`}
                            onClick={() => onNavigate(issue.location, issue.entityType === 'Workspace' ? '' : issue.entityName)}
                            className="w-full text-left pl-14 pr-4 py-2 flex items-start gap-3 hover:bg-white transition-colors"
                          >
                            <span className="text-sm text-slate-600 flex-1">{issue.message}</span>
                            <span className="text-xs text-slate-400 flex-shrink-0">{issue.entityType}</span>
                          </button>
                          {action?.kind === 'repair-unresolved-rpti-row' && onRepairUnresolvedRow && (
                            <button type="button" data-testid={`repair-unresolved-row-${action.rowId}`}
                              onClick={() => onRepairUnresolvedRow(action.rowId)}
                              className="ml-14 mb-2 rounded-lg border border-indigo-300 bg-white px-3 py-1 text-sm font-medium text-indigo-700 hover:bg-indigo-50">
                              Repair
                            </button>
                          )}
                          {action?.kind === 'extend-import-prior-phase' && onExtendImportPriorPhase && (
                            <button type="button" data-testid={`extend-import-prior-phase-${action.segmentId}`}
                              onClick={() => onExtendImportPriorPhase(action.segmentId)}
                              className="ml-14 mb-2 rounded-lg border border-amber-300 bg-white px-3 py-1 text-sm font-medium text-amber-700 hover:bg-amber-50">
                              Extend
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
