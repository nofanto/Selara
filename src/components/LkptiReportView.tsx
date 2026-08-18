import React from 'react';
import { LkptiDetail, Deliverable } from '../types';
import { Download } from 'lucide-react';
import { RPTI_CATEGORY_LABELS } from '../lib/rpti';
import { exportLkptiReportToExcel } from '../lib/lkpti';

interface LkptiReportViewProps {
  lkptiDetails: LkptiDetail[];
  deliverables: Deliverable[];
}

export function LkptiReportView({ lkptiDetails, deliverables }: LkptiReportViewProps) {
  const targetName = (detail: LkptiDetail): string =>
    deliverables.find(d => d.id === detail.targetId)?.name ?? '—';

  return (
    <div data-testid="lkpti-report-view" className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-sm text-slate-500">
          LKPTI rows are managed in <span className="font-medium text-slate-700">Data Manager → LKPTI</span>. This screen is a read-only summary and export.
        </p>
        <div className="flex-1" />
        {lkptiDetails.length > 0 && (
          <button
            onClick={() => exportLkptiReportToExcel(lkptiDetails, deliverables)}
            data-testid="lkpti-report-export-btn"
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
          >
            <Download size={16} />
            Export to Excel
          </button>
        )}
      </div>

      {lkptiDetails.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-sm">No LKPTI rows recorded yet.</p>
        </div>
      ) : (
        <div data-testid="lkpti-detail-table" className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 text-left">No.</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-left">Platform</th>
                <th className="px-3 py-2 text-left">Database</th>
                <th className="px-3 py-2 text-left">Go-Live Date</th>
                <th className="px-3 py-2 text-left">Developer</th>
                <th className="px-3 py-2 text-left">Ownership</th>
              </tr>
            </thead>
            <tbody>
              {lkptiDetails.map((detail, index) => (
                <tr key={detail.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{index + 1}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">{targetName(detail)}</td>
                  <td className="px-3 py-2">{detail.categoryCode ? `${detail.categoryCode} — ${RPTI_CATEGORY_LABELS[detail.categoryCode]}` : '—'}</td>
                  <td className="px-3 py-2">{detail.platform ?? '—'}</td>
                  <td className="px-3 py-2">{detail.database ?? '—'}</td>
                  <td className="px-3 py-2">{detail.goLiveDate ?? '—'}</td>
                  <td className="px-3 py-2">{detail.developer ?? '—'}</td>
                  <td className="px-3 py-2 capitalize">{detail.ownership?.toLowerCase().replace('_', ' ') ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
