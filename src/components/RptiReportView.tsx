import React from 'react';
import { RptiDetail, Initiative, Deliverable, Asset, DeliverableSegment, DeliverableStatus } from '../types';
import { Download } from 'lucide-react';
import { RPTI_CATEGORY_LABELS, suggestDeliverableQuarter, resolveCost, exportRptiReportToExcel } from '../lib/rpti';

interface RptiReportViewProps {
  rptiDetails: RptiDetail[];
  initiatives: Initiative[];
  deliverables: Deliverable[];
  assets: Asset[];
  deliverableSegments: DeliverableSegment[];
  deliverableStatuses: DeliverableStatus[];
  defaultCurrency?: string;
}

export function RptiReportView({ rptiDetails, initiatives, deliverables, assets, deliverableSegments, deliverableStatuses, defaultCurrency = 'USD' }: RptiReportViewProps) {
  const targetName = (detail: RptiDetail): string => {
    if (detail.targetType === 'deliverable') return deliverables.find(a => a.id === detail.targetId)?.name ?? '—';
    return assets.find(a => a.id === detail.targetId)?.name ?? '—';
  };

  return (
    <div data-testid="rpti-report-view" className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-sm text-slate-500">
          RPTI rows are managed in <span className="font-medium text-slate-700">Data Manager → RPTI</span>. This screen is a read-only summary and export.
        </p>
        <div className="flex-1" />
        {rptiDetails.length > 0 && (
          <button
            onClick={() => exportRptiReportToExcel(rptiDetails, initiatives, deliverables, assets, deliverableSegments, deliverableStatuses)}
            data-testid="rpti-report-export-btn"
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
          >
            <Download size={16} />
            Export to Excel
          </button>
        )}
      </div>

      {rptiDetails.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-sm">No RPTI rows recorded yet.</p>
        </div>
      ) : (
        <div data-testid="rpti-detail-table" className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 text-left">No.</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-left">Dev Type</th>
                <th className="px-3 py-2 text-left">Developer</th>
                <th className="px-3 py-2 text-left">Quarter</th>
                <th className="px-3 py-2 text-left">CapEx ({defaultCurrency})</th>
                <th className="px-3 py-2 text-left">OpEx ({defaultCurrency})</th>
                <th className="px-3 py-2 text-left">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {rptiDetails.map((detail, index) => {
                const initiative = initiatives.find(i => i.id === detail.initiativeId);
                const { capexAmount, opexAmount } = resolveCost(detail, initiative);
                const quarter = detail.plannedImplementationQuarter
                  ?? suggestDeliverableQuarter(detail, deliverableSegments, deliverableStatuses).quarter
                  ?? '—';
                return (
                  <tr key={detail.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">{index + 1}</td>
                    <td className="px-3 py-2 font-medium text-slate-800">{targetName(detail)}</td>
                    <td className="px-3 py-2">{detail.categoryCode ? `${detail.categoryCode} — ${RPTI_CATEGORY_LABELS[detail.categoryCode]}` : '—'}</td>
                    <td className="px-3 py-2 capitalize">{detail.developmentType}</td>
                    <td className="px-3 py-2">{detail.developer ?? '—'}</td>
                    <td className="px-3 py-2">{quarter}</td>
                    <td className="px-3 py-2">{defaultCurrency} {capexAmount.toLocaleString()}</td>
                    <td className="px-3 py-2">{defaultCurrency} {opexAmount.toLocaleString()}</td>
                    <td className="px-3 py-2 text-slate-500 max-w-[160px] truncate">{detail.remarks}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
