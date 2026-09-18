import * as fs from 'node:fs';
import * as XLSX from 'xlsx';
import type { Page } from '@playwright/test';

/** Seed persisted state without relying on report-row editors that no longer exist. */
export async function seedReportRecords(page: Page, records: Record<string, object[]>, clear: string[] = []) {
  await page.evaluate(({ records, clear }) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('it-initiative-visualiser');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction([...new Set([...Object.keys(records), ...clear])], 'readwrite');
      for (const store of clear) tx.objectStore(store).clear();
      for (const [store, rows] of Object.entries(records)) for (const row of rows) tx.objectStore(store).put(row);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }), { records, clear });
  await page.reload();
}

export const reportFixture = {
  assets: [{ id: 'filing-asset', name: 'Filing Asset', categoryId: 'filing-category' }],
  assetCategories: [{ id: 'filing-category', name: 'Filing Category', categoryCode: '06', dcCountry: 'Indonesia', drCity: 'Surabaya', drCountry: 'Indonesia' }],
  programmes: [{ id: 'filing-programme', name: 'Filing Programme', color: 'blue' }],
  initiatives: [{ id: 'filing-initiative', name: 'Filing Initiative', programmeId: 'filing-programme', assetId: 'filing-asset',
    startDate: '2026-01-01', endDate: '2026-12-31', capex: 100, opex: 10, rptiRemarks: 'Entity remarks' }],
  deliverables: [{ id: 'filing-deliverable', assetId: 'filing-asset', name: 'Filing Application', type: 'application',
    developer: 'inhouse', dcCity: 'Jakarta', platform: 'Linux RHEL 9', systemOwner: 'Filing Owner' }],
  deliverableSegments: [{ id: 'filing-segment', deliverableId: 'filing-deliverable', initiativeId: 'filing-initiative',
    status: 'appstatus-in-production', startDate: '2026-03-15', endDate: '2026-12-31' }],
};

export async function generateReport(page: Page, report: 'rpti' | 'lkpti', year = '2026') {
  await page.getByTestId('nav-reports').click();
  if (await page.getByTestId('report-back-btn').isVisible()) await page.getByTestId('report-back-btn').click();
  await page.getByTestId(`report-card-${report}`).click();
  await page.getByTestId(`${report}-report-year-input`).fill(year);
  await page.getByTestId(`${report}-generate-report-btn`).click();
}

export async function exportedReportText(page: Page, report: 'rpti' | 'lkpti') {
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId(`${report}-report-export-btn`).click()]);
  const file = await download.path();
  if (!file) throw new Error('No downloaded workbook');
  const workbook = XLSX.read(fs.readFileSync(file), { type: 'buffer' });
  return XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 }).flat().join(' | ');
}

/** Read a store straight out of IndexedDB, to prove what generation did or did not write. */
export async function readStore(page: Page, store: string): Promise<Record<string, unknown>[]> {
  return page.evaluate((store) => new Promise<Record<string, unknown>[]>((resolve, reject) => {
    const request = indexedDB.open('it-initiative-visualiser');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const all = db.transaction(store, 'readonly').objectStore(store).getAll();
      all.onsuccess = () => { db.close(); resolve(all.result as Record<string, unknown>[]); };
      all.onerror = () => { db.close(); reject(all.error); };
    };
  }), store);
}
