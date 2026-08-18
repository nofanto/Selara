/**
 * Bundled RPTI (OJK-aligned) asset catalogue.
 *
 * Replaces the GEANZ (NZ Government Enterprise Architecture) catalogue with a
 * catalogue built around OJK's own RptiCategoryCode values — see
 * requirement-specs/rpti-asset-catalogue.md for the full design rationale.
 *
 * Each area is backed by a real AssetCategory (see `rptiCatalogueAssetCategories`)
 * whose `categoryCode` matches the area, so a Deliverable added under a
 * catalogue-added Asset auto-classifies for RPTI reporting via the same
 * AssetCategory default-inheritance `generateRptiDetails()` already implements —
 * no separate classification field or lookup needed.
 */

import { AssetCategory, RptiCategoryCode } from '../types';
import { RPTI_CATEGORY_LABELS } from './rpti';

export interface RptiCatalogueAssetEntry {
  name: string;
  externalId: string; // Stable synthetic id, e.g. "rpti-catalogue-05-payment-gateway" — doubles as the "is this a catalogue asset" detection key and keeps "+ Add all" idempotent.
}

export interface RptiCatalogueArea {
  code: RptiCategoryCode;
  categoryId: string; // e.g. "cat-rpti-05" — id of the matching AssetCategory in rptiCatalogueAssetCategories
  name: string;
  assets: RptiCatalogueAssetEntry[];
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function area(code: RptiCategoryCode, assetNames: string[]): RptiCatalogueArea {
  return {
    code,
    categoryId: `cat-rpti-${code}`,
    name: RPTI_CATEGORY_LABELS[code],
    assets: assetNames.map(name => ({ name, externalId: `rpti-catalogue-${code}-${slug(name)}` })),
  };
}

export const rptiCatalogueAreas: RptiCatalogueArea[] = [
  area('01', ['Customer Onboarding System', 'Customer Relationship Management (CRM)']),
  area('02', ['Savings Account System', 'Current Account System', 'Time Deposit (Deposito) System']),
  area('03', ['Loan Origination System (LOS)', 'Loan Management System (LMS)', 'Credit Scoring Engine']),
  area('04', ['Core Banking General Ledger']),
  area('05', ['Payment Gateway', 'RTGS Interface']),
  area('06', ['Agent Banking Application', 'QRIS Payment Service', 'Video Banking Service']),
  area('07', ['Treasury Management System', 'FX Dealing System']),
  area('08', ['Trade Finance / Letter of Credit (LC) System', 'Bank Guarantee System']),
  area('09', ['AML Transaction Monitoring System', 'Sanctions & Watchlist Screening']),
  area('10', ['Regulatory Reporting Platform', 'Management Information System (MIS)', 'Data Warehouse for Regulatory Reporting', 'Business Intelligence & Analytics Platform']),
  area('11', ['Enterprise Risk Management (ERM) System', 'Credit Risk Rating Engine']),
  area('12', ['Human Resource Information System (HRIS)', 'Procurement & Vendor Management System', 'Email & Collaboration Platform']),
  area('49', []),
  area('51', ['Primary Data Center Infrastructure', 'Disaster Recovery Center']),
  area('52', ['Core Banking Server Platform', 'IT Infrastructure Monitoring System', 'Application Performance Monitoring System']),
  area('53', ['Wide Area Network (WAN)', 'Branch Connectivity Network']),
  area('54', ['Multi-Factor Authentication Platform', 'Firewall / Intrusion Prevention System', 'SIEM Platform']),
  area('99', []),
];

export const rptiCatalogueAssetCategories: AssetCategory[] = rptiCatalogueAreas.map(a => ({
  id: a.categoryId,
  name: a.name,
  categoryCode: a.code,
}));
