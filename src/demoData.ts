import { Asset, Deliverable, DeliverableSegment, DeliverableStatus, Initiative, Milestone, Programme, Strategy, Dependency, AssetCategory, TimelineSettings, Resource } from './types';
import { rptiCatalogueAssetCategories } from './lib/rptiCatalogue';

/**
 * Returns a date string (YYYY-MM-DD) relative to the current calendar year.
 * yearOffset=0 → current year, yearOffset=1 → next year, etc.
 */
function relDate(yearOffset: number, month: number, day: number): string {
    const year = new Date().getFullYear() + yearOffset;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export const demoTimelineSettings: TimelineSettings = {
    startDate: relDate(0, 1, 1),
    monthsToShow: 36,
    budgetVisualisation: 'off',
    descriptionDisplay: 'off',
    emptyRowDisplay: 'show',
    snapToPeriod: 'off',
    conflictDetection: 'on',
    showRelationships: 'on',
    collapsedGroups: [],
    sidebarWidth: 256,
    defaultCurrency: 'IDR',
};

export const demoAssetCategories: AssetCategory[] = [
    // categoryCode/DC-DR fields are RPTI defaults: a Deliverable's own values (set below)
    // override these per field. Not every category needs one — cat-data/cat-core/cat-cloud/
    // cat-int are left without RPTI defaults, same as a category legitimately can be.
    { id: 'cat-iam', name: 'Identity & Access Management', order: 1, categoryCode: '12', dcCity: 'Jakarta', dcCountry: 'Indonesia', drCity: 'Bandung', drCountry: 'Indonesia' },
    { id: 'cat-data', name: 'Data Platform', order: 2 },
    { id: 'cat-channel', name: 'Customer Channels', order: 3, categoryCode: '06', dcCity: 'Jakarta', dcCountry: 'Indonesia', drCity: 'Surabaya', drCountry: 'Indonesia' },
    { id: 'cat-core', name: 'Core Banking', order: 4 },
    { id: 'cat-cloud', name: 'Cloud Infrastructure', order: 5 },
    { id: 'cat-int', name: 'Integration & APIs', order: 6 },
    // One AssetCategory per RPTI catalogue area (see src/lib/rptiCatalogue.ts) — rendered
    // in the dedicated catalogue section below, not the main category list, but real
    // records so a Deliverable added under a catalogue asset auto-classifies for RPTI.
    ...rptiCatalogueAssetCategories,
];

export const demoStrategies: Strategy[] = [
    { id: 'strat-cloud', name: 'Cloud First', color: 'bg-sky-500' },
    { id: 'strat-cust', name: 'Customer First', color: 'bg-indigo-500' },
    { id: 'strat-zero', name: 'Zero Trust', color: 'bg-rose-500' },
    { id: 'strat-api', name: 'API-Led Architecture', color: 'bg-emerald-500' },
    { id: 'strat-data', name: 'Data-Driven Decisions', color: 'bg-amber-500' },
    { id: 'strat-reg', name: 'Regulatory Compliance', color: 'bg-orange-500' },
];

export const demoProgrammes: Programme[] = [
    { id: 'prog-dtp', name: 'Digital Transformation', color: 'bg-blue-500' },
    { id: 'prog-reg', name: 'Regulatory Programme', color: 'bg-amber-500' },
    { id: 'prog-cloud', name: 'Cloud Migration', color: 'bg-sky-500' },
    { id: 'prog-cx', name: 'Customer Experience', color: 'bg-fuchsia-500' },
    { id: 'prog-mod', name: 'Tech Modernisation', color: 'bg-rose-500' },
    { id: 'prog-data', name: 'Data & Analytics', color: 'bg-emerald-500' },
];

export const demoAssets: Asset[] = [
    // Identity & Access Management
    { id: 'a-ciam', name: 'Customer IAM (CIAM)', categoryId: 'cat-iam', maturity: 5 },
    { id: 'a-eiam', name: 'Employee IAM', categoryId: 'cat-iam', maturity: 3 },
    { id: 'a-pam', name: 'Privileged Access Mgmt', categoryId: 'cat-iam', maturity: 1 },
    // Data Platform
    { id: 'a-lake', name: 'Enterprise Data Lake', categoryId: 'cat-data', maturity: 3 },
    { id: 'a-dwh', name: 'Data Warehouse', categoryId: 'cat-data', maturity: 4 },
    { id: 'a-mdm', name: 'Master Data Mgmt', categoryId: 'cat-data' },
    // Customer Channels
    { id: 'a-web', name: 'Internet Banking', categoryId: 'cat-channel', maturity: 4 },
    { id: 'a-mobile', name: 'Mobile Banking App', categoryId: 'cat-channel', maturity: 3 },
    { id: 'a-cc', name: 'Contact Centre Platform', categoryId: 'cat-channel', maturity: 2 },
    // Core Banking
    { id: 'a-core', name: 'Core Ledger', categoryId: 'cat-core', maturity: 2 },
    { id: 'a-pay', name: 'Payments Engine', categoryId: 'cat-core', maturity: 3 },
    { id: 'a-lend', name: 'Lending Platform', categoryId: 'cat-core', maturity: 2 },
    // Cloud Infrastructure
    { id: 'a-k8s', name: 'Kubernetes Platform', categoryId: 'cat-cloud', maturity: 4 },
    { id: 'a-obs', name: 'Observability Stack', categoryId: 'cat-cloud', maturity: 3 },
    // Integration & APIs
    { id: 'a-apigw', name: 'API Gateway', categoryId: 'cat-int', maturity: 4 },
    { id: 'a-esb', name: 'Enterprise Service Bus', categoryId: 'cat-int', maturity: 1 },

    // ── RPTI Application Catalogue (pre-populated areas) ────────────────────────
    // 01 Customer management
    { id: 'rc-case',    name: 'Customer Onboarding System',                       categoryId: 'cat-rpti-01', maturity: 3, externalId: 'rpti-catalogue-01-customer-onboarding-system' },
    { id: 'rc-crm',     name: 'Customer Relationship Management (CRM)',           categoryId: 'cat-rpti-01', maturity: 2, externalId: 'rpti-catalogue-01-customer-relationship-management-crm' },
    // 04 General Ledger
    { id: 'rc-fmis',    name: 'Core Banking General Ledger',                      categoryId: 'cat-rpti-04', maturity: 3, externalId: 'rpti-catalogue-04-core-banking-general-ledger' },
    // 05 Payments
    { id: 'rc-apimgmt', name: 'Payment Gateway',                                  categoryId: 'cat-rpti-05', maturity: 4, externalId: 'rpti-catalogue-05-payment-gateway' },
    { id: 'rc-gesb',    name: 'RTGS Interface',                                   categoryId: 'cat-rpti-05', maturity: 1, externalId: 'rpti-catalogue-05-rtgs-interface' },
    // 06 Digital services
    { id: 'rc-portal',  name: 'Agent Banking Application',                        categoryId: 'cat-rpti-06', maturity: 4, externalId: 'rpti-catalogue-06-agent-banking-application' },
    { id: 'rc-wcm',     name: 'QRIS Payment Service',                             categoryId: 'cat-rpti-06', maturity: 3, externalId: 'rpti-catalogue-06-qris-payment-service' },
    { id: 'rc-video',   name: 'Video Banking Service',                            categoryId: 'cat-rpti-06', maturity: 4, externalId: 'rpti-catalogue-06-video-banking-service' },
    // 09 AML-CFT and PPPSPM
    { id: 'rc-datagov', name: 'AML Transaction Monitoring System',                categoryId: 'cat-rpti-09', maturity: 2, externalId: 'rpti-catalogue-09-aml-transaction-monitoring-system' },
    { id: 'rc-records', name: 'Sanctions & Watchlist Screening',                  categoryId: 'cat-rpti-09', maturity: 3, externalId: 'rpti-catalogue-09-sanctions-watchlist-screening' },
    // 10 Management information / reporting systems
    { id: 'rc-bpm',     name: 'Regulatory Reporting Platform',                    categoryId: 'cat-rpti-10', maturity: 2, externalId: 'rpti-catalogue-10-regulatory-reporting-platform' },
    { id: 'rc-itsm',    name: 'Management Information System (MIS)',              categoryId: 'cat-rpti-10', maturity: 4, externalId: 'rpti-catalogue-10-management-information-system-mis' },
    { id: 'rc-dwh',     name: 'Data Warehouse for Regulatory Reporting',          categoryId: 'cat-rpti-10', maturity: 3, externalId: 'rpti-catalogue-10-data-warehouse-for-regulatory-reporting' },
    { id: 'rc-bi',      name: 'Business Intelligence & Analytics Platform',       categoryId: 'cat-rpti-10', maturity: 2, externalId: 'rpti-catalogue-10-business-intelligence-analytics-platform' },
    // 11 Risk management
    { id: 'rc-idgov',   name: 'Enterprise Risk Management (ERM) System',          categoryId: 'cat-rpti-11', maturity: 2, externalId: 'rpti-catalogue-11-enterprise-risk-management-erm-system' },
    // 12 Internal management
    { id: 'rc-hrm',     name: 'Human Resource Information System (HRIS)',         categoryId: 'cat-rpti-12', maturity: 3, externalId: 'rpti-catalogue-12-human-resource-information-system-hris' },
    { id: 'rc-erp',     name: 'Procurement & Vendor Management System',           categoryId: 'cat-rpti-12', maturity: 2, externalId: 'rpti-catalogue-12-procurement-vendor-management-system' },
    { id: 'rc-email',   name: 'Email & Collaboration Platform',                   categoryId: 'cat-rpti-12', maturity: 4, externalId: 'rpti-catalogue-12-email-collaboration-platform' },
    // 51 Data Center / Disaster Recovery Center
    { id: 'rc-iaas',    name: 'Primary Data Center Infrastructure',               categoryId: 'cat-rpti-51', maturity: 4, externalId: 'rpti-catalogue-51-primary-data-center-infrastructure' },
    { id: 'rc-paas',    name: 'Disaster Recovery Center',                         categoryId: 'cat-rpti-51', maturity: 3, externalId: 'rpti-catalogue-51-disaster-recovery-center' },
    // 52 Servers and/or platforms
    { id: 'rc-cmdb',    name: 'Core Banking Server Platform',                     categoryId: 'cat-rpti-52', maturity: 2, externalId: 'rpti-catalogue-52-core-banking-server-platform' },
    { id: 'rc-sysmon',  name: 'IT Infrastructure Monitoring System',              categoryId: 'cat-rpti-52', maturity: 3, externalId: 'rpti-catalogue-52-it-infrastructure-monitoring-system' },
    { id: 'rc-apm',     name: 'Application Performance Monitoring System',        categoryId: 'cat-rpti-52', maturity: 3, externalId: 'rpti-catalogue-52-application-performance-monitoring-system' },
    // 54 Security systems
    { id: 'rc-authn',   name: 'Multi-Factor Authentication Platform',             categoryId: 'cat-rpti-54', maturity: 3, externalId: 'rpti-catalogue-54-multi-factor-authentication-platform' },
    { id: 'rc-netsec',  name: 'Firewall / Intrusion Prevention System',           categoryId: 'cat-rpti-54', maturity: 3, externalId: 'rpti-catalogue-54-firewall-intrusion-prevention-system' },
    { id: 'rc-siem',    name: 'SIEM Platform',                                    categoryId: 'cat-rpti-54', maturity: 2, externalId: 'rpti-catalogue-54-siem-platform' },
];

export const demoDeliverables: Deliverable[] = [
    // Customer IAM (CIAM) — a-ciam / cat-iam (RPTI default categoryCode '12', DC Jakarta/DR Bandung)
    // Both Okta and Keycloak override categoryCode to '01' (customer-facing, not the category's
    // internal-management default) — demonstrating why a category default alone isn't always enough.
    { id: 'app-okta', assetId: 'a-ciam', name: 'Okta', categoryCode: '01', developer: 'inhouse' },
    { id: 'app-azuread', assetId: 'a-ciam', name: 'Azure AD B2C' },
    // Keycloak overrides categoryCode + dcCity/dcCountry, but leaves drCity/drCountry
    // unset — those two fall back to cat-iam's Bandung/Indonesia default.
    { id: 'app-keycloak', assetId: 'a-ciam', name: 'Keycloak', categoryCode: '01', developer: 'PPJTI', dcCity: 'Singapore', dcCountry: 'Singapore' },
    // Internet Banking — a-web
    { id: 'app-angular', assetId: 'a-web', name: 'Angular Frontend' },
    { id: 'app-bff', assetId: 'a-web', name: 'BFF Service' },
    // Mobile Banking App — a-mobile / cat-channel (RPTI default categoryCode '06', DC Jakarta/DR Surabaya)
    { id: 'app-ios', assetId: 'a-mobile', name: 'iOS App' },
    { id: 'app-android', assetId: 'a-mobile', name: 'Android App' },
    // React Native Shell sets only developer — categoryCode and all four location fields are
    // left unset, so every one of them falls back to cat-channel's category-level default.
    { id: 'app-rn', assetId: 'a-mobile', name: 'React Native Shell', developer: 'inhouse' },
    // ── RPTI catalogue deliverables ─────────────────────────────────────────────
    // Unlike GEANZ's shared category (which had no AssetCategory backing it), each
    // catalogue asset's categoryId now points at a real AssetCategory with its own
    // categoryCode default (see rptiCatalogueAssetCategories) — so most of these
    // need no per-deliverable override at all. Only developer/location, which have
    // no category-level default, get set explicitly, same as everywhere else.
    { id: 'app-rc-fmis',    assetId: 'rc-fmis',    name: 'Core Banking General Ledger' },
    { id: 'app-rc-authn',   assetId: 'rc-authn',   name: 'Multi-Factor Authentication Platform', developer: 'inhouse', dcCity: 'Jakarta', dcCountry: 'Indonesia', drCity: 'Surabaya', drCountry: 'Indonesia' },
    { id: 'app-rc-email',   assetId: 'rc-email',   name: 'Email & Collaboration Platform', developer: 'PPJTI', dcCity: 'Jakarta', dcCountry: 'Indonesia', drCity: 'Surabaya', drCountry: 'Indonesia' },
    { id: 'app-rc-iaas',    assetId: 'rc-iaas',    name: 'Primary Data Center Infrastructure', type: 'infrastructure', developer: 'PPJTI', dcCity: 'Singapore', dcCountry: 'Singapore', drCity: 'Jakarta', drCountry: 'Indonesia' },
    { id: 'app-rc-gesb',    assetId: 'rc-gesb',    name: 'RTGS Interface', type: 'infrastructure' },
    { id: 'app-rc-siem',    assetId: 'rc-siem',    name: 'SIEM Platform', developer: 'inhouse', dcCity: 'Jakarta', dcCountry: 'Indonesia', drCity: 'Surabaya', drCountry: 'Indonesia' },
    { id: 'app-rc-portal',  assetId: 'rc-portal',  name: 'Agent Banking Application' },
    { id: 'app-rc-itsm',    assetId: 'rc-itsm',    name: 'Management Information System (MIS)' },
    { id: 'app-rc-apimgmt', assetId: 'rc-apimgmt', name: 'Payment Gateway' },
];

export const demoDeliverableSegments: DeliverableSegment[] = [
    // Okta — in production across the full visible range; linked to the Passkey Rollout
    // initiative (RPTI generation treats this as an 'upgrade' — Okta's already live).
    { id: 'seg-okta-prod', deliverableId: 'app-okta', status: 'appstatus-in-production', startDate: relDate(-1, 1, 1), endDate: relDate(2, 12, 31), initiativeId: 'i-ciam-passkey' },
    // Azure AD B2C — in production, then sunset as CIAM migrates to Okta
    { id: 'seg-azuread-prod', deliverableId: 'app-azuread', status: 'appstatus-in-production', startDate: relDate(-1, 1, 1), endDate: relDate(0, 6, 30) },
    { id: 'seg-azuread-sunset', deliverableId: 'app-azuread', status: 'appstatus-sunset', startDate: relDate(0, 7, 1), endDate: relDate(1, 6, 30) },
    { id: 'seg-azuread-oos', deliverableId: 'app-azuread', status: 'appstatus-out-of-support', startDate: relDate(1, 7, 1), endDate: relDate(2, 6, 30) },
    // Keycloak — planned then funded as a potential alternative; linked to SSO Consolidation
    // (RPTI generation treats this as 'new' — Keycloak has never gone live).
    { id: 'seg-keycloak-planned', deliverableId: 'app-keycloak', status: 'appstatus-planned', startDate: relDate(0, 1, 1), endDate: relDate(0, 9, 30), initiativeId: 'i-ciam-sso' },
    { id: 'seg-keycloak-funded', deliverableId: 'app-keycloak', status: 'appstatus-funded', startDate: relDate(0, 10, 1), endDate: relDate(1, 12, 31), initiativeId: 'i-ciam-sso' },
    // Angular Frontend — long-running in production
    { id: 'seg-angular-prod', deliverableId: 'app-angular', status: 'appstatus-in-production', startDate: relDate(-1, 1, 1), endDate: relDate(2, 12, 31) },
    // BFF Service — in production, moving to sunset as architecture evolves
    { id: 'seg-bff-prod', deliverableId: 'app-bff', status: 'appstatus-in-production', startDate: relDate(-1, 1, 1), endDate: relDate(1, 6, 30) },
    { id: 'seg-bff-sunset', deliverableId: 'app-bff', status: 'appstatus-sunset', startDate: relDate(1, 7, 1), endDate: relDate(2, 12, 31) },
    // iOS App — in production, then eventual React Native consolidation
    { id: 'seg-ios-prod', deliverableId: 'app-ios', status: 'appstatus-in-production', startDate: relDate(-1, 1, 1), endDate: relDate(1, 6, 30) },
    { id: 'seg-ios-sunset', deliverableId: 'app-ios', status: 'appstatus-sunset', startDate: relDate(1, 7, 1), endDate: relDate(2, 6, 30) },
    // Android App — in production throughout
    { id: 'seg-android-prod', deliverableId: 'app-android', status: 'appstatus-in-production', startDate: relDate(-1, 1, 1), endDate: relDate(2, 12, 31) },
    // React Native Shell — planned, funded, then in production as consolidation succeeds;
    // all three linked to the React Native Rewrite initiative that drives the whole lifecycle.
    { id: 'seg-rn-planned', deliverableId: 'app-rn', status: 'appstatus-planned', startDate: relDate(0, 1, 1), endDate: relDate(0, 6, 30), initiativeId: 'i-mobile-rn' },
    { id: 'seg-rn-funded', deliverableId: 'app-rn', status: 'appstatus-funded', startDate: relDate(0, 7, 1), endDate: relDate(1, 3, 31), initiativeId: 'i-mobile-rn' },
    { id: 'seg-rn-prod', deliverableId: 'app-rn', status: 'appstatus-in-production', startDate: relDate(1, 4, 1), endDate: relDate(2, 12, 31), initiativeId: 'i-mobile-rn' },

    // ── RPTI catalogue asset lifecycle segments ─────────────────────────────────
    // GL — in production, migrating to cloud
    { id: 'seg-rc-fmis-prod',      deliverableId: 'app-rc-fmis',    status: 'appstatus-in-production', startDate: relDate(-1, 1, 1), endDate: relDate(1, 3, 31) },
    { id: 'seg-rc-fmis-sunset',    deliverableId: 'app-rc-fmis',    status: 'appstatus-sunset',        startDate: relDate(1, 4, 1),  endDate: relDate(2, 6, 30), row: 1 },
    // MFA — current platform phasing out, replacement being funded
    { id: 'seg-rc-authn-prod',     deliverableId: 'app-rc-authn',   status: 'appstatus-in-production', startDate: relDate(-1, 1, 1), endDate: relDate(0, 6, 30) },
    { id: 'seg-rc-authn-funded',   deliverableId: 'app-rc-authn',   status: 'appstatus-funded',        startDate: relDate(0, 1, 1),  endDate: relDate(0, 6, 30), row: 1, initiativeId: 'i-rc-authn-mfa' },
    { id: 'seg-rc-authn-new-prod', deliverableId: 'app-rc-authn',   status: 'appstatus-in-production', startDate: relDate(0, 7, 1),  endDate: relDate(2, 12, 31), row: 1 },
    // Email — legacy mail in production, M365 funded and going live
    { id: 'seg-rc-email-legacy',   deliverableId: 'app-rc-email',   status: 'appstatus-in-production', startDate: relDate(-1, 1, 1), endDate: relDate(0, 6, 30) },
    { id: 'seg-rc-email-m365-fd',  deliverableId: 'app-rc-email',   status: 'appstatus-funded',        startDate: relDate(0, 1, 1),  endDate: relDate(0, 5, 31), row: 1, initiativeId: 'i-rc-email-m365' },
    { id: 'seg-rc-email-m365',     deliverableId: 'app-rc-email',   status: 'appstatus-in-production', startDate: relDate(0, 7, 1),  endDate: relDate(2, 12, 31), row: 1 },
    // Primary DC — on-prem datacentre running down as cloud ramps up
    { id: 'seg-rc-iaas-onprem',    deliverableId: 'app-rc-iaas',    status: 'appstatus-in-production', startDate: relDate(-1, 1, 1), endDate: relDate(1, 6, 30) },
    { id: 'seg-rc-iaas-cloud-fd',  deliverableId: 'app-rc-iaas',    status: 'appstatus-funded',        startDate: relDate(0, 1, 1),  endDate: relDate(1, 6, 30), row: 1, initiativeId: 'i-rc-iaas-migration' },
    { id: 'seg-rc-iaas-sunset',    deliverableId: 'app-rc-iaas',    status: 'appstatus-sunset',        startDate: relDate(1, 7, 1),  endDate: relDate(2, 6, 30) },
    { id: 'seg-rc-iaas-cloud',     deliverableId: 'app-rc-iaas',    status: 'appstatus-in-production', startDate: relDate(1, 7, 1),  endDate: relDate(2, 12, 31), row: 1 },
    // RTGS Interface — production until retirement
    { id: 'seg-rc-gesb-prod',      deliverableId: 'app-rc-gesb',    status: 'appstatus-in-production', startDate: relDate(-1, 1, 1), endDate: relDate(2, 12, 31) },
    { id: 'seg-rc-gesb-sunset',    deliverableId: 'app-rc-gesb',    status: 'appstatus-sunset',        startDate: relDate(1, 1, 1),  endDate: relDate(2, 12, 31), row: 1 },
    // SIEM — platform upgrade in progress
    { id: 'seg-rc-siem-prod',      deliverableId: 'app-rc-siem',    status: 'appstatus-in-production', startDate: relDate(-1, 1, 1), endDate: relDate(0, 12, 31) },
    { id: 'seg-rc-siem-funded',    deliverableId: 'app-rc-siem',    status: 'appstatus-funded',        startDate: relDate(0, 7, 1),  endDate: relDate(1, 3, 31), row: 1, initiativeId: 'i-rc-siem-upgrade' },
    { id: 'seg-rc-siem-new',       deliverableId: 'app-rc-siem',    status: 'appstatus-in-production', startDate: relDate(1, 4, 1),  endDate: relDate(2, 12, 31), row: 1 },
    // Agent Banking Application — long-running production service
    { id: 'seg-rc-portal-prod',    deliverableId: 'app-rc-portal',  status: 'appstatus-in-production', startDate: relDate(-1, 1, 1), endDate: relDate(2, 12, 31) },
    // MIS — in production
    { id: 'seg-rc-itsm-prod',      deliverableId: 'app-rc-itsm',    status: 'appstatus-in-production', startDate: relDate(-1, 1, 1), endDate: relDate(2, 12, 31) },
    // Payment Gateway — in production
    { id: 'seg-rc-api-prod',       deliverableId: 'app-rc-apimgmt', status: 'appstatus-in-production', startDate: relDate(0, 1, 1),  endDate: relDate(2, 12, 31) },
];

export const demoInitiatives: Initiative[] = [
    // CIAM
    {
        id: 'i-ciam-passkey', name: 'Passkey Rollout', programmeId: 'prog-dtp', strategyId: 'strat-zero',
        assetId: 'a-ciam', startDate: relDate(0, 1, 1), endDate: relDate(0, 6, 30), capex: 350000, opex: 0,
        description: 'Replace SMS OTP with FIDO2 passkeys for all customer-facing channels.',
        status: 'active', progress: 40, ownerId: 'res-4', resourceIds: ['res-2', 'res-3'],
    },
    {
        id: 'i-ciam-sso', name: 'SSO Consolidation', programmeId: 'prog-dtp', strategyId: 'strat-cust',
        assetId: 'a-ciam', startDate: relDate(0, 7, 1), endDate: relDate(1, 3, 31), capex: 600000, opex: 0,
        description: 'Unify 12 legacy identity providers into a single CIAM platform.',
        status: 'planned', progress: 0, ownerId: 'res-1', resourceIds: ['res-3'],
    },
    // Employee IAM
    {
        id: 'i-eiam-ztna', name: 'Zero Trust Network Access', programmeId: 'prog-mod', strategyId: 'strat-zero',
        assetId: 'a-eiam', startDate: relDate(0, 4, 1), endDate: relDate(1, 1, 31), capex: 800000, opex: 0,
        description: 'Implement identity-centric perimeter for all internal applications.',
        status: 'planned', progress: 0, ownerId: 'res-4',
    },
    // PAM
    {
        id: 'i-pam-vault', name: 'Secrets Vault Migration', programmeId: 'prog-cloud', strategyId: 'strat-cloud',
        assetId: 'a-pam', startDate: relDate(0, 3, 1), endDate: relDate(0, 9, 30), capex: 250000, opex: 0,
        description: 'Move from legacy PAM to cloud-native HashiCorp Vault.',
        status: 'active', progress: 10, ownerId: 'res-4', resourceIds: ['res-5'],
    },
    // Data Lake
    {
        id: 'i-lake-ingest', name: 'Real-Time Ingestion', programmeId: 'prog-data', strategyId: 'strat-data',
        assetId: 'a-lake', startDate: relDate(0, 1, 1), endDate: relDate(0, 9, 30), capex: 1200000, opex: 0,
        description: 'Kafka-based streaming ingestion pipeline replacing nightly batch ETL.',
        status: 'active', progress: 30, ownerId: 'res-6', resourceIds: ['res-3', 'res-5'],
    },
    {
        id: 'i-lake-gov', name: 'Data Governance Framework', programmeId: 'prog-reg', strategyId: 'strat-reg',
        assetId: 'a-lake', startDate: relDate(0, 10, 1), endDate: relDate(1, 6, 30), capex: 500000, opex: 0,
        description: 'Implement data lineage, quality scoring, and automated PII tagging.',
        status: 'planned', progress: 0, ownerId: 'res-2',
    },
    // Data Warehouse
    {
        id: 'i-dwh-snow', name: 'Snowflake Migration', programmeId: 'prog-cloud', strategyId: 'strat-cloud',
        assetId: 'a-dwh', startDate: relDate(0, 4, 1), endDate: relDate(1, 3, 31), capex: 2000000, opex: 0,
        description: 'Migrate on-prem Teradata warehouse to Snowflake on AWS.',
        status: 'planned', progress: 0, ownerId: 'res-6', resourceIds: ['res-5'],
    },
    // MDM
    {
        id: 'i-mdm-golden', name: 'Golden Customer Record', programmeId: 'prog-cx', strategyId: 'strat-data',
        assetId: 'a-mdm', startDate: relDate(0, 6, 1), endDate: relDate(1, 3, 31), capex: 750000, opex: 0,
        description: 'Create single 360° customer view across banking, insurance and wealth.',
        status: 'planned', progress: 0, ownerId: 'res-1', resourceIds: ['res-3'],
    },
    // Internet Banking
    {
        id: 'i-web-redesign', name: 'Web Platform Redesign', programmeId: 'prog-cx', strategyId: 'strat-cust',
        assetId: 'a-web', startDate: relDate(0, 1, 1), endDate: relDate(0, 12, 31), capex: 3000000, opex: 0,
        description: 'Complete redesign of the internet banking UIUX using React + Tailwind micro-frontends.',
        status: 'active', progress: 20, ownerId: 'res-1', resourceIds: ['res-2', 'res-6'],
    },
    {
        id: 'i-web-a11y', name: 'WCAG 2.2 AA Compliance', programmeId: 'prog-reg', strategyId: 'strat-reg',
        assetId: 'a-web', startDate: relDate(1, 1, 1), endDate: relDate(1, 6, 30), capex: 400000, opex: 0,
        description: 'Accessibility remediation to meet WCAG 2.2 Level AA for all customer journeys.',
        status: 'planned', progress: 0, ownerId: 'res-2',
    },
    // Mobile Banking
    {
        id: 'i-mobile-rn', name: 'React Native Rewrite', programmeId: 'prog-dtp', strategyId: 'strat-cust',
        assetId: 'a-mobile', startDate: relDate(0, 3, 1), endDate: relDate(1, 6, 30), capex: 4500000, opex: 0,
        description: 'Rewrite native iOS and Android apps as a single React Native codebase.',
        status: 'active', progress: 5, ownerId: 'res-6', resourceIds: ['res-2', 'res-3'],
    },
    // Contact Centre
    {
        id: 'i-cc-ai', name: 'AI-Powered IVR', programmeId: 'prog-cx', strategyId: 'strat-data',
        assetId: 'a-cc', startDate: relDate(0, 7, 1), endDate: relDate(1, 3, 31), capex: 900000, opex: 0,
        description: 'Deploy conversational AI to handle 60% of Tier 1 support calls.',
        status: 'planned', progress: 0, ownerId: 'res-2',
    },
    // Core Ledger
    {
        id: 'i-core-iso', name: 'ISO 20022 Migration', programmeId: 'prog-reg', strategyId: 'strat-reg',
        assetId: 'a-core', startDate: relDate(0, 1, 1), endDate: relDate(1, 6, 30), capex: 5000000, opex: 0,
        description: 'Upgrade core messaging to ISO 20022 format for SWIFT and domestic payments.',
        status: 'active', progress: 10, ownerId: 'res-1', resourceIds: ['res-2', 'res-6'],
    },
    {
        id: 'i-core-api', name: 'Core Banking API Layer', programmeId: 'prog-mod', strategyId: 'strat-api',
        assetId: 'a-core', startDate: relDate(1, 1, 1), endDate: relDate(1, 12, 31), capex: 2500000, opex: 0,
        description: 'Wrap legacy COBOL core with gRPC and REST APIs for channel consumption.',
        status: 'planned', progress: 0, ownerId: 'res-6',
    },
    // Payments Engine
    {
        id: 'i-pay-rtp', name: 'Real-Time Payments Gateway', programmeId: 'prog-dtp', strategyId: 'strat-api',
        assetId: 'a-pay', startDate: relDate(0, 4, 1), endDate: relDate(1, 3, 31), capex: 1800000, opex: 0,
        description: 'Connect to the national real-time payments network (NPP/FPS).',
        status: 'planned', progress: 0, ownerId: 'res-6', resourceIds: ['res-5'],
    },
    {
        id: 'i-pay-fraud', name: 'Transaction Fraud ML', programmeId: 'prog-data', strategyId: 'strat-data',
        assetId: 'a-pay', startDate: relDate(0, 10, 1), endDate: relDate(1, 6, 30), capex: 700000, opex: 0,
        description: 'Deploy ML models for real-time fraud scoring on all payment channels.',
        status: 'planned', progress: 0, ownerId: 'res-2', resourceIds: ['res-3'],
    },
    // API Gateway
    {
        id: 'i-apigw-v2', name: 'API Gateway v2 Migration', programmeId: 'prog-mod', strategyId: 'strat-api',
        assetId: 'a-apigw', startDate: relDate(0, 1, 1), endDate: relDate(0, 6, 30), capex: 350000, opex: 0,
        description: 'Migrate from Kong to cloud-native AWS API Gateway with WAF integration.',
        status: 'active', progress: 50, ownerId: 'res-2', resourceIds: ['res-5'],
    },
    {
        id: 'i-apigw-portal', name: 'Developer Portal Launch', programmeId: 'prog-dtp', strategyId: 'strat-api',
        assetId: 'a-apigw', startDate: relDate(0, 7, 1), endDate: relDate(1, 1, 31), capex: 300000, opex: 0,
        description: 'Self-service developer portal for internal and partner API consumers.',
        status: 'planned', progress: 0, ownerId: 'res-6',
    },
    // Enterprise Service Bus
    {
        id: 'i-esb-decomm', name: 'ESB Decommission', programmeId: 'prog-mod', strategyId: 'strat-api',
        assetId: 'a-esb', startDate: relDate(1, 1, 1), endDate: relDate(2, 6, 30), capex: 1200000, opex: 0,
        description: 'Progressively decommission on-prem ESB by migrating integrations to event-driven architecture.',
        status: 'planned', progress: 0, ownerId: 'res-2',
    },
    // Lending
    {
        id: 'i-lend-auto', name: 'Automated Decisioning', programmeId: 'prog-mod', strategyId: 'strat-data',
        assetId: 'a-lend', startDate: relDate(0, 6, 1), endDate: relDate(1, 3, 31), capex: 1500000, opex: 0,
        description: 'New real-time credit scoring engine based on cloud-native decisioning platform.',
        status: 'planned', progress: 0, ownerId: 'res-6', resourceIds: ['res-3'],
    },
    {
        id: 'i-lend-open', name: 'Open Banking Origination', programmeId: 'prog-reg', strategyId: 'strat-reg',
        assetId: 'a-lend', startDate: relDate(1, 4, 1), endDate: relDate(2, 3, 31), capex: 900000, opex: 0,
        description: 'Integrate CDR/Open Banking data into loan origination for richer affordability checks.',
        status: 'planned', progress: 0, ownerId: 'res-1',
    },
    {
        id: 'i-placeholder-1',
        name: 'Future Strategy',
        programmeId: 'prog-dtp',
        strategyId: 'strat-cloud',
        assetId: 'a-k8s',
        startDate: relDate(2, 1, 1),
        endDate: relDate(2, 12, 31),
        capex: 0, opex: 0,
        description: 'Placeholder for future cloud-native workloads.',
        status: 'planned', progress: 0,
        isPlaceholder: true
    },

    // ── RPTI catalogue initiatives ───────────────────────────────────────────────
    // 04 — General Ledger
    {
        id: 'i-rc-fmis-cloud', name: 'GL Cloud Uplift', programmeId: 'prog-cloud', strategyId: 'strat-cloud',
        assetId: 'rc-fmis', startDate: relDate(0, 1, 1), endDate: relDate(1, 3, 31), capex: 1800000, opex: 0,
        description: 'Migrate the on-premises general ledger to a cloud-native core banking GL platform.',
        status: 'active', progress: 20, ownerId: 'res-1', resourceIds: ['res-5'],
    },
    // 12 — HRIS
    {
        id: 'i-rc-hrm-selfserv', name: 'HR Self-Service Portal', programmeId: 'prog-dtp', strategyId: 'strat-cust',
        assetId: 'rc-hrm', startDate: relDate(0, 4, 1), endDate: relDate(0, 12, 31), capex: 400000, opex: 0,
        description: 'Deploy employee self-service module for leave, payslips and benefits.',
        status: 'planned', progress: 0, ownerId: 'res-1',
    },
    // 12 — Procurement
    {
        id: 'i-rc-erp-consolidate', name: 'Procurement Platform Consolidation', programmeId: 'prog-mod', strategyId: 'strat-api',
        assetId: 'rc-erp', startDate: relDate(1, 1, 1), endDate: relDate(2, 6, 30), capex: 3500000, opex: 0,
        description: 'Consolidate fragmented procurement and vendor systems into a single cloud platform.',
        status: 'planned', progress: 0, ownerId: 'res-6',
    },
    // 01 — Customer Onboarding
    {
        id: 'i-rc-case-upgrade', name: 'Onboarding Platform Upgrade', programmeId: 'prog-mod', strategyId: 'strat-cust',
        assetId: 'rc-case', startDate: relDate(0, 6, 1), endDate: relDate(1, 3, 31), capex: 850000, opex: 0,
        description: 'Replace manual account-opening processes with a cloud-native, API-first onboarding platform.',
        status: 'planned', progress: 0, ownerId: 'res-1', resourceIds: ['res-2'],
    },
    // 01 — CRM
    {
        id: 'i-rc-crm-migrate', name: 'CRM Cloud Migration', programmeId: 'prog-cloud', strategyId: 'strat-cloud',
        assetId: 'rc-crm', startDate: relDate(0, 3, 1), endDate: relDate(1, 1, 31), capex: 1200000, opex: 0,
        description: 'Migrate on-premises CRM to cloud, integrating with onboarding and the contact centre.',
        status: 'active', progress: 10, ownerId: 'res-6', resourceIds: ['res-3'],
    },
    // 06 — Agent Banking
    {
        id: 'i-rc-portal-redesign', name: 'Agent Banking Redesign', programmeId: 'prog-cx', strategyId: 'strat-cust',
        assetId: 'rc-portal', startDate: relDate(0, 1, 1), endDate: relDate(0, 9, 30), capex: 600000, opex: 0,
        description: 'Redesign the agent banking application to meet OJK digital service standards.',
        status: 'active', progress: 35, ownerId: 'res-2', resourceIds: ['res-3'],
    },
    // 06 — QRIS
    {
        id: 'i-rc-wcm-headless', name: 'QRIS Service Expansion', programmeId: 'prog-dtp', strategyId: 'strat-api',
        assetId: 'rc-wcm', startDate: relDate(0, 10, 1), endDate: relDate(1, 6, 30), capex: 300000, opex: 0,
        description: 'Extend QRIS payment acceptance to new merchant segments and channels.',
        status: 'planned', progress: 0, ownerId: 'res-2',
    },
    // 09 — AML Monitoring
    {
        id: 'i-rc-datagov-prog', name: 'AML Monitoring Uplift', programmeId: 'prog-reg', strategyId: 'strat-reg',
        assetId: 'rc-datagov', startDate: relDate(0, 1, 1), endDate: relDate(1, 3, 31), capex: 500000, opex: 0,
        description: 'Uplift AML transaction monitoring rules and case management to meet OJK AML-CFT requirements.',
        status: 'active', progress: 20, ownerId: 'res-2', resourceIds: ['res-3'],
    },
    // 09 — Sanctions Screening
    {
        id: 'i-rc-records-digital', name: 'Sanctions Screening Modernisation', programmeId: 'prog-dtp', strategyId: 'strat-reg',
        assetId: 'rc-records', startDate: relDate(0, 7, 1), endDate: relDate(1, 6, 30), capex: 400000, opex: 0,
        description: 'Modernise sanctions and watchlist screening with real-time list updates.',
        status: 'planned', progress: 0, ownerId: 'res-1',
    },
    // 05 — Payment Gateway
    {
        id: 'i-rc-api-platform', name: 'Payment Gateway Uplift', programmeId: 'prog-mod', strategyId: 'strat-api',
        assetId: 'rc-apimgmt', startDate: relDate(0, 1, 1), endDate: relDate(0, 9, 30), capex: 750000, opex: 0,
        description: 'Upgrade the payment gateway to support new merchant integrations and higher transaction volume.',
        status: 'active', progress: 60, ownerId: 'res-2', resourceIds: ['res-5'],
    },
    // 05 — RTGS
    {
        id: 'i-rc-esb-retire', name: 'RTGS Interface Modernisation', programmeId: 'prog-mod', strategyId: 'strat-api',
        assetId: 'rc-gesb', startDate: relDate(1, 1, 1), endDate: relDate(2, 12, 31), capex: 2000000, opex: 0,
        description: 'Replace the legacy RTGS interface with a resilient, standards-based messaging layer.',
        status: 'planned', progress: 0, ownerId: 'res-6',
    },
    // 11 — Risk Management
    {
        id: 'i-rc-idgov-jml', name: 'Risk Rating Model Refresh', programmeId: 'prog-dtp', strategyId: 'strat-zero',
        assetId: 'rc-idgov', startDate: relDate(0, 4, 1), endDate: relDate(1, 1, 31), capex: 450000, opex: 0,
        description: 'Refresh the enterprise risk rating model to align with updated OJK risk-based capital guidance.',
        status: 'planned', progress: 0, ownerId: 'res-4',
    },
    // 54 — MFA
    {
        id: 'i-rc-authn-mfa', name: 'MFA Modernisation', programmeId: 'prog-dtp', strategyId: 'strat-zero',
        assetId: 'rc-authn', startDate: relDate(0, 1, 1), endDate: relDate(0, 6, 30), capex: 250000, opex: 0,
        description: 'Replace SMS OTP with phishing-resistant MFA (FIDO2/passkeys) for all staff.',
        status: 'active', progress: 75, ownerId: 'res-4', resourceIds: ['res-3'],
    },
    // 54 — Network Security
    {
        id: 'i-rc-netsec-seg', name: 'Network Segmentation Project', programmeId: 'prog-mod', strategyId: 'strat-zero',
        assetId: 'rc-netsec', startDate: relDate(0, 3, 1), endDate: relDate(1, 3, 31), capex: 900000, opex: 0,
        description: 'Implement micro-segmentation across the bank network to reduce lateral movement risk.',
        status: 'planned', progress: 0, ownerId: 'res-4',
    },
    // 54 — SIEM
    {
        id: 'i-rc-siem-upgrade', name: 'SIEM Platform Upgrade', programmeId: 'prog-mod', strategyId: 'strat-reg',
        assetId: 'rc-siem', startDate: relDate(0, 7, 1), endDate: relDate(1, 3, 31), capex: 650000, opex: 0,
        description: 'Upgrade SIEM to support OJK-aligned security monitoring and automated alerting.',
        status: 'planned', progress: 0, ownerId: 'res-4', resourceIds: ['res-5'],
    },
    // 10 — Regulatory Reporting Automation
    {
        id: 'i-rc-bpm-automate', name: 'Regulatory Reporting Automation', programmeId: 'prog-dtp', strategyId: 'strat-api',
        assetId: 'rc-bpm', startDate: relDate(0, 6, 1), endDate: relDate(1, 3, 31), capex: 800000, opex: 0,
        description: 'Automate high-volume regulatory reporting and approval workflows.',
        status: 'planned', progress: 0, ownerId: 'res-6', resourceIds: ['res-3'],
    },
    // 10 — MIS
    {
        id: 'i-rc-itsm-consolidate', name: 'MIS Tool Consolidation', programmeId: 'prog-mod', strategyId: 'strat-api',
        assetId: 'rc-itsm', startDate: relDate(0, 1, 1), endDate: relDate(0, 9, 30), capex: 350000, opex: 0,
        description: 'Consolidate three fragmented reporting tools into a single enterprise MIS platform.',
        status: 'active', progress: 45, ownerId: 'res-6',
    },
    // 52 — Server Platform
    {
        id: 'i-rc-cmdb-auto', name: 'Server Platform Automation', programmeId: 'prog-cloud', strategyId: 'strat-cloud',
        assetId: 'rc-cmdb', startDate: relDate(0, 10, 1), endDate: relDate(1, 6, 30), capex: 300000, opex: 0,
        description: 'Automate server inventory discovery and reconciliation with cloud infrastructure.',
        status: 'planned', progress: 0, ownerId: 'res-5',
    },
    // 12 — Email & Collaboration
    {
        id: 'i-rc-email-m365', name: 'Microsoft 365 Migration', programmeId: 'prog-cloud', strategyId: 'strat-cloud',
        assetId: 'rc-email', startDate: relDate(0, 1, 1), endDate: relDate(0, 6, 30), capex: 400000, opex: 0,
        description: 'Migrate bank email and collaboration tools from on-premises Exchange to Microsoft 365.',
        status: 'active', progress: 80, ownerId: 'res-5', resourceIds: ['res-3'],
    },
    // 06 — Video Banking
    {
        id: 'i-rc-video-upgrade', name: 'Video Banking Rollout', programmeId: 'prog-cx', strategyId: 'strat-cust',
        assetId: 'rc-video', startDate: relDate(0, 7, 1), endDate: relDate(0, 12, 31), capex: 150000, opex: 0,
        description: 'Launch a video banking service across priority branches.',
        status: 'planned', progress: 0, ownerId: 'res-5',
    },
    // 52 — Monitoring
    {
        id: 'i-rc-sysmon-unified', name: 'Unified Monitoring Platform', programmeId: 'prog-cloud', strategyId: 'strat-cloud',
        assetId: 'rc-sysmon', startDate: relDate(0, 4, 1), endDate: relDate(1, 1, 31), capex: 500000, opex: 0,
        description: 'Consolidate fragmented monitoring tools into a single observability platform.',
        status: 'planned', progress: 0, ownerId: 'res-5', resourceIds: ['res-6'],
    },
    // 52 — APM
    {
        id: 'i-rc-apm-rollout', name: 'APM Rollout', programmeId: 'prog-cloud', strategyId: 'strat-api',
        assetId: 'rc-apm', startDate: relDate(0, 7, 1), endDate: relDate(1, 3, 31), capex: 250000, opex: 0,
        description: 'Deploy application performance monitoring across all customer-facing digital services.',
        status: 'planned', progress: 0, ownerId: 'res-5',
    },
    // 51 — Primary Data Center
    {
        id: 'i-rc-iaas-migration', name: 'Data Center Consolidation', programmeId: 'prog-cloud', strategyId: 'strat-cloud',
        assetId: 'rc-iaas', startDate: relDate(0, 1, 1), endDate: relDate(1, 6, 30), capex: 2500000, opex: 0,
        description: 'Consolidate the primary data center onto modern, resilient infrastructure.',
        status: 'active', progress: 25, ownerId: 'res-6', resourceIds: ['res-5'],
    },
    // 51 — Disaster Recovery Center
    {
        id: 'i-rc-paas-k8s', name: 'DR Site Uplift', programmeId: 'prog-cloud', strategyId: 'strat-cloud',
        assetId: 'rc-paas', startDate: relDate(0, 6, 1), endDate: relDate(1, 6, 30), capex: 800000, opex: 0,
        description: 'Uplift the disaster recovery center to meet updated OJK business continuity requirements.',
        status: 'planned', progress: 0, ownerId: 'res-6',
    },
    // 10 — Regulatory Reporting DWH
    {
        id: 'i-rc-dwh-cloud', name: 'Regulatory Reporting DWH', programmeId: 'prog-data', strategyId: 'strat-data',
        assetId: 'rc-dwh', startDate: relDate(0, 4, 1), endDate: relDate(1, 6, 30), capex: 1800000, opex: 0,
        description: 'Build a dedicated data warehouse feeding OJK and internal regulatory reports.',
        status: 'planned', progress: 0, ownerId: 'res-6', resourceIds: ['res-3'],
    },
    // 10 — BI
    {
        id: 'i-rc-bi-selfserv', name: 'Self-Service BI Platform', programmeId: 'prog-data', strategyId: 'strat-data',
        assetId: 'rc-bi', startDate: relDate(0, 10, 1), endDate: relDate(1, 9, 30), capex: 600000, opex: 0,
        description: 'Deploy self-service BI tooling enabling business units to create their own reports.',
        status: 'planned', progress: 0, ownerId: 'res-2', resourceIds: ['res-3'],
    },
];

export const demoDependencies: Dependency[] = [
    { id: 'dep-1', sourceId: 'i-ciam-passkey', targetId: 'i-ciam-sso', type: 'blocks' },
    { id: 'dep-2', sourceId: 'i-lake-ingest', targetId: 'i-lake-gov', type: 'blocks' },
    { id: 'dep-3', sourceId: 'i-web-redesign', targetId: 'i-web-a11y', type: 'blocks' },
    { id: 'dep-5', sourceId: 'i-apigw-v2', targetId: 'i-apigw-portal', type: 'blocks' },
    { id: 'dep-6', sourceId: 'i-core-iso', targetId: 'i-core-api', type: 'blocks' },
    { id: 'dep-7', sourceId: 'i-pay-rtp', targetId: 'i-pay-fraud', type: 'requires' },
    { id: 'dep-8', sourceId: 'i-dwh-snow', targetId: 'i-mdm-golden', type: 'requires' },
    { id: 'dep-9', sourceId: 'i-apigw-v2', targetId: 'i-esb-decomm', type: 'blocks' },
    { id: 'dep-10', sourceId: 'i-lend-auto', targetId: 'i-lend-open', type: 'blocks' },
];

export const demoMilestones: Milestone[] = [
    { id: 'ms-1', assetId: 'a-core', date: relDate(0, 11, 1), name: 'SWIFT ISO 20022 Deadline', type: 'critical' },
    { id: 'ms-2', assetId: 'a-web', date: relDate(1, 7, 1), name: 'WCAG Compliance Audit', type: 'critical' },
    { id: 'ms-3', assetId: 'a-pay', date: relDate(1, 4, 1), name: 'NPP Go-Live', type: 'critical' },
    { id: 'ms-4', assetId: 'a-mobile', date: relDate(1, 7, 1), name: 'App Store Launch', type: 'warning' },
    { id: 'ms-5', assetId: 'a-k8s', date: relDate(0, 10, 1), name: 'DR Failover Test', type: 'warning' },
    { id: 'ms-6', assetId: 'a-esb', date: relDate(2, 7, 1), name: 'ESB End of Life', type: 'critical' },
    { id: 'ms-7', assetId: 'a-lake', date: relDate(1, 1, 1), name: 'Batch ETL Sunset', type: 'warning' },
    { id: 'ms-8', assetId: 'a-lend', date: relDate(1, 10, 1), name: 'Open Banking Phase 3', type: 'info' },
    // RPTI catalogue milestones
    { id: 'ms-rc-1', assetId: 'rc-fmis',    date: relDate(0, 6, 30),  name: 'GL Contract Renewal Decision',        type: 'warning' },
    { id: 'ms-rc-2', assetId: 'rc-email',   date: relDate(0, 6, 30),  name: 'M365 Cutover Complete',                type: 'critical' },
    { id: 'ms-rc-3', assetId: 'rc-iaas',    date: relDate(1, 6, 30),  name: 'Data Center Consolidation Deadline',  type: 'critical' },
    { id: 'ms-rc-4', assetId: 'rc-gesb',    date: relDate(2, 12, 31), name: 'Legacy RTGS Interface End of Life',   type: 'critical' },
    { id: 'ms-rc-5', assetId: 'rc-authn',   date: relDate(0, 6, 30),  name: 'MFA Rollout Complete',                 type: 'info' },
    { id: 'ms-rc-6', assetId: 'rc-datagov', date: relDate(1, 3, 31),  name: 'AML Monitoring Framework Live',       type: 'info' },
];

export const demoResources: Resource[] = [
    { id: 'res-1', name: 'Sarah Chen', role: 'Programme Manager' },
    { id: 'res-2', name: 'James Okafor', role: 'Enterprise Architect' },
    { id: 'res-3', name: 'Business Analyst' },
    { id: 'res-4', name: 'Maria Santos', role: 'Security Architect' },
    { id: 'res-5', name: 'Cloud Engineer' },
    { id: 'res-6', name: 'Tom Wright', role: 'Tech Lead' },
];

export const demoDeliverableStatuses: DeliverableStatus[] = [
    { id: 'appstatus-planned',        name: 'Planned',          color: 'bg-slate-400' },
    { id: 'appstatus-funded',         name: 'Funded',           color: 'bg-blue-400' },
    { id: 'appstatus-in-production',  name: 'In Production',    color: 'bg-emerald-500' },
    { id: 'appstatus-sunset',         name: 'Sunset',           color: 'bg-amber-500' },
    { id: 'appstatus-out-of-support', name: 'Out of Support',   color: 'bg-orange-500' },
    { id: 'appstatus-retired',        name: 'Retired',          color: 'bg-slate-300' },
];
