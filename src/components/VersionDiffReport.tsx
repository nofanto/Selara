import { useMemo } from 'react';
import { Version, Decision } from '../types';
import { X, ArrowRight, FileText, Check } from 'lucide-react';
import { computeDiff } from '../lib/diff';
import { decisionsForSpan } from '../lib/historyStream';
import { DiffSections } from './DiffSection';

export function VersionComparisonReport({ baseVersion, comparisonData, decisions, onClose }: {
  baseVersion: Version,
  comparisonData: Version['data'],
  decisions: Decision[],
  onClose: () => void
}) {
  const diff = useMemo(() => computeDiff(baseVersion, comparisonData), [baseVersion, comparisonData]);
  // The report always compares the baseline against the live workspace, so the
  // far end of the span is "now" — an endpoint with a timestamp but no version.
  const spanDecisions = useMemo(
    () => decisionsForSpan(decisions, baseVersion, { id: '', timestamp: new Date().toISOString() }),
    [decisions, baseVersion],
  );

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-6">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col relative animate-in slide-in-from-bottom-8 duration-300">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-50/30 rounded-t-3xl">
          <h3 className="text-xl font-bold text-slate-900">Difference Report</h3>
          <button
            onClick={onClose}
            data-testid="close-report"
            aria-label="Close"
            className="p-2 hover:bg-white rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-10">
          <div className="flex items-center gap-4 bg-indigo-50 p-4 rounded-2xl border border-indigo-100 shrink-0">
            <div className="flex-1 text-center">
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Baseline</p>
              <p className="font-bold text-indigo-900 truncate px-2">{baseVersion.name}</p>
            </div>
            <ArrowRight className="text-indigo-300" />
            <div className="flex-1 text-center">
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Current State</p>
              <p className="font-bold text-indigo-900">Today</p>
            </div>
          </div>

          {/*
            AC3 — the payoff. Decisions had zero presence in the surface people
            actually use, so writing one was unrewarded. Listing them here is what
            makes the log worth keeping: it turns "I wrote this down" into "my own
            diffs explain themselves". An empty span says so out loud, so a change
            nobody documented reads as a visible gap rather than silence.
          */}
          <div data-testid="diff-decisions" className="rounded-2xl border border-slate-200 p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              Decisions in this span
            </p>
            {spanDecisions.length === 0 ? (
              <p className="text-sm text-slate-400">
                No decisions recorded for this period — nothing explains why these changes were made.
              </p>
            ) : (
              <ul className="space-y-2">
                {spanDecisions.map(d => (
                  <li key={d.id} className="flex items-start gap-2">
                    <FileText size={14} className="mt-0.5 text-slate-300 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{d.title}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(d.createdAt).toLocaleDateString()} &middot; {d.status}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!diff.hasChanges ? (
            <div className="py-20 text-center text-slate-400">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={40} className="opacity-20 text-emerald-500" />
              </div>
              <p className="font-bold text-slate-500">No changes detected</p>
              <p className="text-sm mt-1">This version exactly matches the current state.</p>
            </div>
          ) : (
            <DiffSections diff={diff} />
          )}
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-3xl shrink-0">
          <button 
            onClick={onClose}
            data-testid="close-report-btn"
            className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
}
