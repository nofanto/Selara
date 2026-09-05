import React, { useMemo, useState } from 'react';
import { Box, ClipboardList, FileText, FolderTree, GitBranch, History, LayoutGrid, Layers, LucideIcon, Tags, Users } from 'lucide-react';
import { DiffResult, DiffSectionKey, EntityDiff } from '../lib/diff';
import { DiffSummary, SummaryChange, SummaryGroup, summarizeDiff } from '../lib/diffSummary';

/**
 * The entity types a DiffResult carries, in render order. Every key of
 * DiffResult apart from `hasChanges` appears here, so a new entity type added
 * to computeDiff surfaces in both diff views the moment it is listed.
 */
const DIFF_SECTIONS: { key: DiffSectionKey; title: string; icon: LucideIcon }[] = [
  { key: 'assets', title: 'Assets', icon: LayoutGrid },
  { key: 'programmes', title: 'Programmes', icon: Users },
  { key: 'strategies', title: 'Strategies', icon: GitBranch },
  { key: 'initiatives', title: 'Initiatives', icon: LayoutGrid },
  { key: 'dependencies', title: 'Relationships', icon: History },
  { key: 'milestones', title: 'Milestones', icon: FileText },
  { key: 'deliverables', title: 'Deliverables', icon: Box },
  { key: 'deliverableSegments', title: 'Deliverable Segments', icon: Layers },
  { key: 'deliverableStatuses', title: 'App Statuses', icon: Tags },
  { key: 'resources', title: 'Resources', icon: Users },
  { key: 'assetCategories', title: 'Categories', icon: FolderTree },
  { key: 'rptiDetails', title: 'RPTI', icon: ClipboardList },
  { key: 'lkptiDetails', title: 'LKPTI', icon: ClipboardList },
];

function DiffSection({ title, data, icon: Icon }: { title: string; data: EntityDiff; icon: LucideIcon }) {
  if (data.added.length === 0 && data.removed.length === 0 && data.modified.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
        <Icon size={18} className="text-slate-400" />
        <h4 className="font-bold text-slate-800">{title}</h4>
      </div>

      <div className="space-y-3">
        {/* Added */}
        {data.added.map((entry, idx) => (
          <div key={`add-${entry.id}-${idx}`} className="flex items-start gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-sm">
            <span className="px-1.5 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded uppercase mt-0.5">Added</span>
            <span className="font-medium text-emerald-900">{entry.name}</span>
          </div>
        ))}

        {/* Removed */}
        {data.removed.map((entry, idx) => (
          <div key={`rem-${entry.id}-${idx}`} className="flex items-start gap-3 p-3 bg-red-50 rounded-xl border border-red-100 text-sm opacity-80">
            <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded uppercase mt-0.5">Removed</span>
            <span className="font-medium text-red-900 line-through">{entry.name}</span>
          </div>
        ))}

        {/* Modified */}
        {data.modified.map((item, idx) => (
          <div key={`mod-${item.id}-${idx}`} className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-sm">
            <div className="flex items-start gap-3 mb-2">
              <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded uppercase mt-0.5">Changed</span>
              <span className="font-bold text-amber-900">{item.name}</span>
            </div>
            <ul className="space-y-1 ml-14">
              {item.changes.map((c, cIdx) => (
                <li key={cIdx} className="text-xs text-amber-700 flex items-start gap-2">
                  <span className="opacity-40">•</span>
                  {c}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

const KIND_STYLES: Record<SummaryChange['kind'], { label: string; pill: string; row: string; text: string }> = {
  added: { label: 'Added', pill: 'bg-emerald-500', row: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-900' },
  removed: { label: 'Removed', pill: 'bg-red-500', row: 'bg-red-50 border-red-100', text: 'text-red-900 line-through' },
  modified: { label: 'Changed', pill: 'bg-amber-500', row: 'bg-amber-50 border-amber-100', text: 'text-amber-900' },
};

function SummaryChangeRow({ change }: { change: SummaryChange }) {
  const style = KIND_STYLES[change.kind];
  return (
    <div className={`p-3 rounded-xl border text-sm ${style.row}`}>
      <div className="flex items-start gap-3">
        <span className={`px-1.5 py-0.5 ${style.pill} text-white text-[10px] font-bold rounded uppercase mt-0.5 shrink-0`}>{style.label}</span>
        <span className={`font-medium ${style.text}`}>{change.name}</span>
      </div>
      {change.changes.length > 0 && (
        <ul className="space-y-1 mt-2 ml-14">
          {change.changes.map((c, idx) => (
            <li key={idx} className="text-xs text-slate-600 flex items-start gap-2">
              <span className="opacity-40">•</span>
              {c}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SummaryGroupCard({ group }: { group: SummaryGroup }) {
  return (
    <div data-testid="summary-group" className="space-y-3">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
        <LayoutGrid size={18} className="text-slate-400" />
        <h4 data-testid="summary-group-title" className="font-bold text-slate-800">{group.title}</h4>
        <span className="text-xs text-slate-400">
          {group.changeCount} {group.changeCount === 1 ? 'change' : 'changes'}
        </span>
      </div>

      {/* An added or removed asset states that one fact; its children are implied by it. */}
      {group.assetChange ? (
        <div className={`p-3 rounded-xl border text-sm ${KIND_STYLES[group.assetChange.kind].row}`}>
          <div className="flex items-start gap-3">
            <span className={`px-1.5 py-0.5 ${KIND_STYLES[group.assetChange.kind].pill} text-white text-[10px] font-bold rounded uppercase mt-0.5 shrink-0`}>
              {KIND_STYLES[group.assetChange.kind].label}
            </span>
            <span className={`font-medium ${KIND_STYLES[group.assetChange.kind].text}`}>{group.title}</span>
          </div>
          {group.assetChange.childCounts.length > 0 && (
            <p className="text-xs text-slate-600 mt-2 ml-14">
              {group.assetChange.kind === 'removed' ? 'Went with it: ' : 'Came with it: '}
              {group.assetChange.childCounts.map(c => c.label).join(', ')}
            </p>
          )}
        </div>
      ) : (
        <>
          {group.changes.length > 0 && (
            <div className="space-y-3">
              {group.changes.map(change => (
                <SummaryChangeRow key={`${change.section}-${change.kind}-${change.id}`} change={change} />
              ))}
            </div>
          )}

          {group.clusters.map(cluster => (
            <div key={cluster.deliverable.id} className="space-y-2 pl-3 border-l-2 border-slate-100">
              <h5 className="text-xs font-bold uppercase tracking-wide text-slate-500">{cluster.title}</h5>
              <div className="space-y-3">
                {cluster.changes.map(change => (
                  <SummaryChangeRow key={`${change.section}-${change.kind}-${change.id}`} change={change} />
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function DiffSummaryView({ summary }: { summary: DiffSummary }) {
  if (summary.groups.length === 0) {
    return (
      <div data-testid="summary-empty" className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-600">
        No substantive changes.
        {summary.cosmeticCount > 0 && (
          <>
            {' '}
            {summary.cosmeticCount} cosmetic {summary.cosmeticCount === 1 ? 'change is' : 'changes are'} hidden — see All changes.
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {summary.groups.map(group => (
        <SummaryGroupCard key={group.asset?.id ?? '__portfolio__'} group={group} />
      ))}
    </div>
  );
}

/**
 * A diff, shared by the Version Comparison modal and the History Differences report.
 *
 * Two views over one DiffResult: the per-asset **Summary** it opens on, and the
 * **All changes** entity-type breakdown that is the audit trail. See
 * requirement-specs/diff-summary.md §5 (why there is one component) and §§2-3, 6-8
 * (what the summary does). Sections with no changes render nothing.
 */
export function DiffSections({ diff }: { diff: DiffResult }) {
  const [view, setView] = useState<'summary' | 'all'>('summary');
  const summary = useMemo(() => summarizeDiff(diff), [diff]);

  const tab = (key: 'summary' | 'all', label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={view === key}
      data-testid={`diff-view-${key}`}
      onClick={() => setView(key)}
      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
        view === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div role="tablist" data-testid="diff-view-toggle" className="inline-flex gap-1 p-1 bg-slate-100 rounded-xl">
        {tab('summary', 'Summary')}
        {tab('all', 'All changes')}
      </div>

      {view === 'summary' ? (
        <DiffSummaryView summary={summary} />
      ) : (
        <div className="space-y-8">
          {DIFF_SECTIONS.map(({ key, title, icon }) => (
            <DiffSection key={key} title={title} data={diff[key]} icon={icon} />
          ))}
        </div>
      )}
    </div>
  );
}
