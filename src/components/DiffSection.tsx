import React from 'react';
import { Box, ClipboardList, FileText, FolderTree, GitBranch, History, LayoutGrid, Layers, LucideIcon, Scale, Tags, Users } from 'lucide-react';
import { DiffResult, EntityDiff } from '../lib/diff';

type DiffSectionKey = Exclude<keyof DiffResult, 'hasChanges'>;

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
  { key: 'decisions', title: 'Decisions', icon: Scale },
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

/**
 * The full entity-type breakdown of a diff — the audit-trail view shared by the
 * Version Comparison modal and the History Differences report. Sections with no
 * changes render nothing.
 */
export function DiffSections({ diff }: { diff: DiffResult }) {
  return (
    <div className="space-y-8">
      {DIFF_SECTIONS.map(({ key, title, icon }) => (
        <DiffSection key={key} title={title} data={diff[key]} icon={icon} />
      ))}
    </div>
  );
}
