/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, lazy, Suspense, useRef, useSyncExternalStore } from 'react';
import { Timeline } from './components/Timeline';
import { MobileCardView } from './components/MobileCardView';
import { useMediaQuery } from './lib/useMediaQuery';
import { DataControls } from './components/DataControls';
import { BackupControls } from './components/BackupControls';
import { ModalErrorBoundary, TestErrorThrower } from './components/ErrorBoundary';
import { TutorialModal } from './components/TutorialModal';
import { LandingPage } from './components/LandingPage';
import { LayoutGrid, Table, Loader2, Search, Undo2, Redo2, HelpCircle, BookOpen, AlertTriangle, GitBranch, AlignLeft, DollarSign, MoreHorizontal, BarChart2, ZoomIn, ZoomOut, SlidersHorizontal, X, Keyboard, GitCommit, GitCommitHorizontal, Palette, Box, Boxes, Target, Users, Layers, AppWindow, ClipboardList } from 'lucide-react';

import {
  demoAssets as initialAssets,
  demoInitiatives as initialInitiatives,
  demoMilestones as initialMilestones,
  demoProgrammes as initialProgrammes,
  demoStrategies as initialStrategies,
  demoDependencies as initialDependencies,
  demoAssetCategories as initialAssetCategories,
  demoTimelineSettings as defaultTimelineSettings,
  demoResources as initialResources,
  demoDeliverables as initialDeliverables,
  demoDeliverableSegments as initialDeliverableSegments,
  demoDeliverableStatuses as initialDeliverableStatuses,
} from './demoData';
import { Asset, Deliverable, DeliverableSegment, DeliverableStatus, Decision, RptiDetail, LkptiDetail, Initiative, Milestone, Programme, Strategy, Dependency, AssetCategory, TimelineSettings, Resource, Version } from './types';
import { cn } from './lib/utils';
import {
  getAppData, saveAppData, getAllVersions, readPersistedWorkspace, replaceWorkspace, drainWrites, settleWrites, saveVersion,
  deleteVersion, PendingSaveError, StaleWorkspaceError, DatabaseSupersededError, getStorageState, subscribeStorageState,
  type PersistedWorkspace,
} from './lib/db';
import { importFromExcelWithDiagnostics, readWorkbookFile, SNAPSHOT_DISPLAY_FALLBACK } from './lib/excel';
import { readBackupWorkbook, workspaceFingerprint, type PortableWorkspace } from './lib/workspaceBackup';
import type { PreparedReplacement, ReplaceOutcome, WorkspaceState } from './lib/replacement';
import { ReplacementSummary } from './components/ReplacementSummary';
import { parseRptiImportFile, deriveWorkspaceFromRptiImport } from './lib/rptiImport';
import { parseLkptiImportFile, deriveWorkspaceFromLkptiImport } from './lib/lkptiImport';
import { applyUnresolvedRowRepair, extendImportPriorPhase, type UnresolvedRowRepairRequest } from './lib/unresolvedRowRepair';
import { validateImportSchema } from './lib/importValidation';
import { importSharedWorkspace } from './lib/share';
import { getTemplateData, TemplateId } from './lib/workspaceTemplates';
import { rptiCatalogueAssetCategories } from './lib/rptiCatalogue';
import { buildRestoredWorkspace, describeReplacementEffects, isWorkspaceEmpty, summariseReplacement } from './lib/workspaceState';
import { ConfirmModal } from './components/ConfirmModal';
import { HealthIssueLocation, DataManagerTab } from './lib/dataHealth';
import { SYNC_CHANNEL_NAME, generateTabId, isRemoteSaveMessage, notifyDataSaved } from './lib/tabSync';
import { mergeDeliverableStatuses } from './lib/deliverableStatusDefaults';
import { liftReportRowAttributes } from './lib/attributeLift';

// Lazy load modals and heavy components for code splitting
const FeaturesModal = lazy(() => import('./components/FeaturesModal').then(m => ({ default: m.FeaturesModal })));
const KeyboardShortcutsModal = lazy(() => import('./components/KeyboardShortcutsModal').then(m => ({ default: m.KeyboardShortcutsModal })));
const TemplatePickerModal = lazy(() => import('./components/TemplatePickerModal').then(m => ({ default: m.TemplatePickerModal })));
type OnboardingImportRequest = import('./components/TemplatePickerModal').OnboardingImportRequest;
const DataManager = lazy(() => import('./components/DataManager').then(m => ({ default: m.DataManager })));
const HistoryView = lazy(() => import('./components/HistoryView').then(m => ({ default: m.HistoryView })));
const ReportsView = lazy(() => import('./components/ReportsView').then(m => ({ default: m.ReportsView })));
const HelpView = lazy(() => import('./components/HelpView').then(m => ({ default: m.HelpView })));

type AppState = {
  assets: Asset[];
  deliverables: Deliverable[];
  deliverableSegments: DeliverableSegment[];
  initiatives: Initiative[];
  milestones: Milestone[];
  programmes: Programme[];
  strategies: Strategy[];
  dependencies: Dependency[];
  assetCategories: AssetCategory[];
  timelineSettings: TimelineSettings;
  resources: Resource[];
  deliverableStatuses: DeliverableStatus[];
  decisions: Decision[];
  rptiDetails: RptiDetail[];
  lkptiDetails: LkptiDetail[];
  versions?: Version[];
};

/** Lift old report-row-owned fields at every boundary that admits data to live state. */
function liftWorkspaceReportAttributes(data: AppState): AppState {
  const lifted = liftReportRowAttributes({
    deliverables: data.deliverables || [],
    deliverableSegments: data.deliverableSegments || [],
    deliverableStatuses: data.deliverableStatuses || [],
    initiatives: data.initiatives || [],
    lkptiDetails: data.lkptiDetails || [],
    rptiDetails: data.rptiDetails || [],
  });
  return {
    ...data,
    deliverables: lifted.deliverables,
    deliverableSegments: lifted.deliverableSegments,
    initiatives: lifted.initiatives,
    rptiDetails: lifted.rptiDetails,
  };
}

function isValidSharedAppState(data: unknown): data is AppState {
  if (!data || typeof data !== 'object') return false;
  const record = data as Record<string, unknown>;
  return Array.isArray(record.assets)
    && Array.isArray(record.deliverables)
    && Array.isArray(record.deliverableSegments)
    && Array.isArray(record.initiatives)
    && Array.isArray(record.milestones)
    && Array.isArray(record.programmes)
    && Array.isArray(record.strategies)
    && Array.isArray(record.dependencies)
    && Array.isArray(record.assetCategories)
    && Array.isArray(record.resources)
    && Array.isArray(record.deliverableStatuses)
    && Array.isArray(record.decisions)
    && Array.isArray(record.rptiDetails)
    && Array.isArray(record.lkptiDetails)
    && (record.versions === undefined || Array.isArray(record.versions))
    && !!record.timelineSettings
    && typeof record.timelineSettings === 'object';
}

// Coerces settings values that referenced the removed DTS feature (e.g. a
// stale `groupBy: 'dts-phase'` persisted from before DTS was removed) back
// to a supported default. Timeline.tsx's groupBy switch has no catch-all
// branch, so leaving a stale 'dts-phase' value in place renders a blank
// timeline rather than degrading gracefully.
function sanitizeTimelineSettings(settings: TimelineSettings): TimelineSettings {
  const sanitized = { ...settings };
  if ((sanitized.groupBy as string) === 'dts-phase') sanitized.groupBy = 'asset';
  if ((sanitized.colorBy as string) === 'dts-phase') delete sanitized.colorBy;
  if ((sanitized.mobileBucketMode as string) === 'dts-phase') delete sanitized.mobileBucketMode;
  return sanitized;
}

/** Stored settings as the screen shows them: defaults filled in, legacy shapes migrated. */
function presentSettings(raw: TimelineSettings | undefined): TimelineSettings {
  const rawSettings = raw || {};
  // Migration: if we have legacy startYear but no startDate, convert it
  const migratedSettings = ('startYear' in rawSettings && !('startDate' in rawSettings))
    ? { startDate: `${(rawSettings as { startYear: number }).startYear}-01-01` }
    : {};
  return sanitizeTimelineSettings({ ...defaultTimelineSettings, ...rawSettings, ...migratedSettings });
}

const presentStored = (stored: PersistedWorkspace): WorkspaceState => ({ ...stored, timelineSettings: presentSettings(stored.timelineSettings) });

/**
 * The stored workspace as Backup carries it. Complete stored settings go in
 * exactly as stored; an older, incomplete shape goes in as the screen presents
 * it — the only form it can be restored in.
 */
function toPortable(stored: PersistedWorkspace): PortableWorkspace {
  const raw = stored.timelineSettings as unknown as Record<string, unknown> | undefined;
  const complete = !!raw && Object.keys(SNAPSHOT_DISPLAY_FALLBACK).every(field => raw[field] !== undefined);
  return { ...stored, timelineSettings: complete ? stored.timelineSettings! : presentSettings(stored.timelineSettings) };
}

/** Why a saved version can't be restored as it stands, checked before anything is written. */
function snapshotProblem(version: Version): string | null {
  const data = version?.data as unknown as Record<string, unknown> | undefined;
  if (!data || typeof data !== 'object') return 'it has no snapshot data.';
  const required = ['assets', 'initiatives', 'milestones', 'programmes', 'strategies', 'dependencies', 'assetCategories'];
  const optional = ['deliverables', 'deliverableSegments', 'resources', 'deliverableStatuses', 'rptiDetails', 'lkptiDetails'];
  const broken = [
    ...required.filter(key => !Array.isArray(data[key])),
    ...optional.filter(key => data[key] !== undefined && !Array.isArray(data[key])),
  ];
  if (broken.length > 0) return `its ${broken.join(', ')} ${broken.length > 1 ? 'are' : 'is'} damaged or missing.`;
  if (!data.timelineSettings || typeof data.timelineSettings !== 'object') return 'its timeline settings are missing.';
  return null;
}

const describeError = (error: unknown) =>
  error instanceof Error ? error.message || error.name : String(error);

interface ReplacementRequest {
  title: string;
  message: string;
  confirmLabel: string;
  /** The workspace to write, built from the reviewed base. `versions` undefined keeps History. */
  next: (current: WorkspaceState) => AppState;
  notices: string[];
  undoable: boolean;
  successNotice?: string;
  onCommitted?: () => void;
  onCancelled?: () => void;
}

interface OpenReplacement extends ReplacementRequest {
  prepared: PreparedReplacement;
  error: string | null;
  saving: boolean;
  refreshing: boolean;
}

type ReplacementRequestResult = { status: 'previewing' | 'committed' } | { status: 'failed'; message: string };

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <div className="flex flex-col items-center gap-2 text-slate-500">
        <Loader2 className="animate-spin" size={32} />
        <p className="text-sm">Loading...</p>
      </div>
    </div>
  );
}

export default function App() {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [view, setView] = useState<'visualiser' | 'data' | 'reports' | 'history' | 'guide'>('visualiser');
  const [dataManagerInitialTab, setDataManagerInitialTab] = useState<DataManagerTab | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  // Another tab's upgrade can hold up this tab, or close its database (ADR-0016).
  const storageState = useSyncExternalStore(subscribeStorageState, getStorageState);
  const [isImportingShare, setIsImportingShare] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  
  // Check for share link in URL to skip landing page
  const hasShareId = new URLSearchParams(window.location.search).has('id');

  const [showLandingPage, setShowLandingPage] = useState(
    !hasShareId && !localStorage.getItem('scenia_has_seen_landing') && !localStorage.getItem('scenia-e2e')
  );
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templatePickerIsReset, setTemplatePickerIsReset] = useState(false);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [assetCategories, setAssetCategories] = useState<AssetCategory[]>([]);
  const [timelineSettings, setTimelineSettings] = useState<TimelineSettings>(defaultTimelineSettings);
  const [resources, setResources] = useState<Resource[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [deliverableSegments, setDeliverableSegments] = useState<DeliverableSegment[]>([]);
  const [deliverableStatuses, setDeliverableStatuses] = useState<DeliverableStatus[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [rptiDetails, setRptiDetails] = useState<RptiDetail[]>([]);
  const [lkptiDetails, setLkptiDetails] = useState<LkptiDetail[]>([]);
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);

  const [undoStack, setUndoStack] = useState<AppState[]>([]);
  // A whole-workspace replacement waiting for confirmation, with the stored base it was reviewed against.
  const [openReplacement, setOpenReplacement] = useState<OpenReplacement | null>(null);
  const confirmingReplacementRef = useRef(false);
  const [workspaceNotice, setWorkspaceNotice] = useState<string | null>(null);
  const workspaceNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // True while a replacement, Undo or Redo is saving: nothing else may write (FR-016).
  const operationRef = useRef(false);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  // Bumped whenever the workspace changes here or in another tab; an open preview
  // prepared at an older revision is stale and must be refreshed (FR-015).
  const revisionRef = useRef(0);
  const [persistedRevision, setPersistedRevision] = useState(0);
  // What this tab last wrote or read — the base Undo/Redo must still find stored.
  const lastPersistedRef = useRef<PersistedWorkspace | null>(null);
  const syncRequestRef = useRef(0);
  const localCommitRef = useRef(0);
  const [incomingShare, setIncomingShare] = useState<{ id: string; key: string } | null>(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    const key = window.location.hash.match(/key=([^&]*)/)?.[1];
    return id && key ? { id, key } : null;
  });
  const [initialReport, setInitialReport] = useState<'data-health' | undefined>(undefined);
  const [importSummary, setImportSummary] = useState<{
    lkptiYear: number; rptiYear?: number; lkptiRows: number; rptiRows: number;
    skipped: { rowNumber: number; reason: string }[]; unresolved: number;
  } | null>(null);
  const [redoStack, setRedoStack] = useState<AppState[]>([]);
  const [dbSaveError, setDbSaveError] = useState<string | null>(null);

  // Cross-tab sync (active/passive) — see requirement-specs/cross-tab-sync.md.
  const tabIdRef = useRef(generateTabId());
  const syncChannelRef = useRef<BroadcastChannel | null>(null);
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const syncToastTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [searchQuery, setSearchQuery] = useState('');
  const [showMoreSettingsPanel, setShowMoreSettingsPanel] = useState(false);
  const [showViewOptionsPanel, setShowViewOptionsPanel] = useState(false);
  const [showMobileSheet, setShowMobileSheet] = useState(false);
  const moreSettingsPanelRef = useRef<HTMLDivElement>(null);
  const viewOptionsPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMobileSheet) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowMobileSheet(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showMobileSheet]);
  const undoRef = useRef<() => void>(() => {});
  const redoRef = useRef<() => void>(() => {});

  const getCurrentState = (): AppState => ({
    assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails
  });

  const getCurrentStateRef = useRef(getCurrentState);
  const versionsRef = useRef(versions);
  versionsRef.current = versions;

  // ─── Workspace operations (specs/005-workspace-recovery) ─────────────────
  //
  // Ordinary edits stay optimistic: the screen changes at once and the save is
  // queued (db.ts runs every write in order). Whole-workspace replacements do not:
  // they wait for queued saves, read one coherent stored base, show what will
  // change, and commit only if the store still matches that base — checked inside
  // the replacing transaction. The screen, the Undo stack and any success message
  // change only after that commit.

  const bumpRevision = useCallback(() => {
    revisionRef.current += 1;
    setPersistedRevision(revisionRef.current);
  }, []);

  const notifySaved = useCallback(() => {
    localCommitRef.current += 1;
    if (syncChannelRef.current) notifyDataSaved(syncChannelRef.current, tabIdRef.current);
  }, []);

  const publishState = useCallback((data: AppState) => {
    setAssets(data.assets);
    setDeliverables(data.deliverables || []);
    setDeliverableSegments(data.deliverableSegments || []);
    setInitiatives(data.initiatives);
    setMilestones(data.milestones);
    setProgrammes(data.programmes);
    setStrategies(data.strategies);
    setDependencies(data.dependencies);
    setAssetCategories(data.assetCategories);
    setTimelineSettings(sanitizeTimelineSettings(data.timelineSettings));
    setResources(data.resources || []);
    setDeliverableStatuses(data.deliverableStatuses || []);
    setDecisions(data.decisions || []);
    setRptiDetails(data.rptiDetails || []);
    setLkptiDetails(data.lkptiDetails || []);
  }, []);

  /** Mirrors what a successful write stored, for the base Undo/Redo checks. */
  const rememberStored = useCallback((data: AppState, versions?: Version[]) => {
    lastPersistedRef.current = {
      assets: data.assets,
      deliverables: data.deliverables || [],
      deliverableSegments: data.deliverableSegments || [],
      initiatives: data.initiatives,
      milestones: data.milestones,
      programmes: data.programmes,
      strategies: data.strategies,
      dependencies: data.dependencies,
      assetCategories: data.assetCategories,
      resources: data.resources || [],
      deliverableStatuses: data.deliverableStatuses || [],
      decisions: data.decisions || [],
      rptiDetails: data.rptiDetails || [],
      lkptiDetails: data.lkptiDetails || [],
      timelineSettings: data.timelineSettings,
      versions: versions ?? lastPersistedRef.current?.versions ?? [],
    };
  }, []);

  const showWorkspaceNotice = useCallback((message: string) => {
    setWorkspaceNotice(message);
    if (workspaceNoticeTimerRef.current) clearTimeout(workspaceNoticeTimerRef.current);
    workspaceNoticeTimerRef.current = setTimeout(() => setWorkspaceNotice(null), 8000);
  }, []);

  /**
   * Waits for queued saves and reads the stored base a replacement or backup is
   * built on (FR-015). If the last save of on-screen work failed, it is retried
   * once; if that fails too, nothing is prepared and the unsaved work stays on
   * screen — a preview of stale stored data would misstate what is being replaced.
   */
  const prepareOperation = useCallback(async (): Promise<PreparedReplacement> => {
    // Taken first: any change from here on, local or remote, makes this base stale.
    const revision = revisionRef.current;
    try {
      await drainWrites();
    } catch (error) {
      if (!(error instanceof PendingSaveError)) throw error;
      const onScreen = getCurrentStateRef.current();
      try {
        await saveAppData(onScreen);
      } catch {
        throw error;
      }
      rememberStored(onScreen);
    }
    const stored = await readPersistedWorkspace();
    return { stored, current: presentStored(stored), fingerprint: workspaceFingerprint(stored), revision };
  }, [rememberStored]);

  /**
   * Writes `next` in place of the reviewed base, atomically and only if the store
   * still holds that base. Publishes the new workspace, the Undo entry and the
   * cross-tab notice only once the write has succeeded; on any failure nothing
   * changes and the caller can retry.
   */
  const commitReplacement = useCallback(async (
    next: AppState,
    prepared: PreparedReplacement,
    options: { undoable: boolean; busyLabel?: string },
  ): Promise<ReplaceOutcome> => {
    if (operationRef.current) return { ok: false, stale: false, message: 'Another change is still being saved. Try again when it finishes.' };
    if (prepared.revision !== revisionRef.current) return { ok: false, stale: true, message: new StaleWorkspaceError().message };
    operationRef.current = true;
    setBusyMessage(options.busyLabel ?? 'Saving…');
    try {
      await replaceWorkspace(next, prepared.fingerprint, workspaceFingerprint);
    } catch (error) {
      operationRef.current = false;
      setBusyMessage(null);
      if (error instanceof StaleWorkspaceError) return { ok: false, stale: true, message: error.message };
      console.error('Replacement failed to save:', error instanceof Error ? `${error.name}: ${error.message}` : error);
      return { ok: false, stale: false, message: `Nothing was replaced: saving failed (${describeError(error)}). Your previous workspace is unchanged, and you can try again.` };
    }
    if (options.undoable) {
      // An entry that replaces History records the History it replaced, so Undo restores it (#62).
      const snapshot = getCurrentStateRef.current();
      const entry = next.versions ? { ...snapshot, versions: versionsRef.current } : snapshot;
      setUndoStack(prev => [...prev, entry].slice(-10));
      setRedoStack([]);
    }
    publishState(next);
    if (next.versions) setVersions(next.versions);
    rememberStored(next, next.versions);
    bumpRevision();
    notifySaved();
    setDbSaveError(null);
    operationRef.current = false;
    setBusyMessage(null);
    return { ok: true, stale: false, message: '' };
  }, [publishState, rememberStored, bumpRevision, notifySaved]);

  /**
   * Starts a replacement route. With something to lose — or when the route always
   * previews — it opens the preview; a first-use empty workspace may be replaced
   * directly, with the same conditional, all-or-nothing commit.
   */
  const requestReplacement = useCallback(async (request: ReplacementRequest, alwaysPreview: boolean): Promise<ReplacementRequestResult> => {
    let prepared: PreparedReplacement;
    try {
      prepared = await prepareOperation();
    } catch (error) {
      return { status: 'failed', message: describeError(error) };
    }
    const next = request.next(prepared.current);
    if (!alwaysPreview && !summariseReplacement(prepared.current, next).losesData) {
      const outcome = await commitReplacement(next, prepared, { undoable: request.undoable });
      if (!outcome.ok) return { status: 'failed', message: outcome.message };
      request.onCommitted?.();
      if (request.successNotice) showWorkspaceNotice(request.successNotice);
      return { status: 'committed' };
    }
    setOpenReplacement({ ...request, prepared, error: null, saving: false, refreshing: false });
    return { status: 'previewing' };
  }, [prepareOperation, commitReplacement, showWorkspaceNotice]);

  const confirmReplacement = async () => {
    const pending = openReplacement;
    if (!pending || pending.saving || confirmingReplacementRef.current) return;
    confirmingReplacementRef.current = true;
    setOpenReplacement({ ...pending, saving: true, error: null });
    try {
      const outcome = await commitReplacement(pending.next(pending.prepared.current), pending.prepared, { undoable: pending.undoable });
      if (outcome.ok) {
        setOpenReplacement(null);
        pending.onCommitted?.();
        if (pending.successNotice) showWorkspaceNotice(pending.successNotice);
        return;
      }
      // A stale base stays stale until refreshed, even if no broadcast has arrived yet.
      setOpenReplacement(prev => prev && {
        ...prev, saving: false, error: outcome.message,
        prepared: outcome.stale ? { ...prev.prepared, revision: -1 } : prev.prepared,
      });
    } finally {
      confirmingReplacementRef.current = false;
    }
  };

  const refreshReplacement = async () => {
    if (!openReplacement || openReplacement.refreshing || openReplacement.saving) return;
    setOpenReplacement(prev => prev && { ...prev, refreshing: true });
    try {
      const prepared = await prepareOperation();
      setOpenReplacement(prev => prev && { ...prev, prepared, refreshing: false, error: null });
    } catch (error) {
      setOpenReplacement(prev => prev && { ...prev, refreshing: false, error: describeError(error) });
    }
  };

  const cancelReplacement = () => {
    if (!openReplacement || openReplacement.saving) return;
    openReplacement.onCancelled?.();
    setOpenReplacement(null);
  };

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // A share link in the URL is opened after the workspace loads, so its
        // preview can show what it would replace (R06) — see handleIncomingShare.
        const dbData = await getAppData();
        const loadedVersions = await getAllVersions();
        setVersions(loadedVersions);

        // If the workspace has no user-authored data yet, show the template picker
        // (or auto-load the RPTI catalogue template in E2E mode).
        if (isWorkspaceEmpty(dbData)) {
          if (localStorage.getItem('scenia-e2e')) {
            // E2E mode: auto-load the RPTI catalogue template so existing tests keep working
            const defaults: AppState = {
              assets: initialAssets,
              deliverables: initialDeliverables,
              deliverableSegments: initialDeliverableSegments,
              initiatives: initialInitiatives,
              milestones: initialMilestones,
              programmes: initialProgrammes,
              strategies: initialStrategies,
              dependencies: initialDependencies,
              assetCategories: initialAssetCategories,
              timelineSettings: defaultTimelineSettings,
              resources: initialResources,
              deliverableStatuses: initialDeliverableStatuses,
              decisions: [],
              rptiDetails: [],
              lkptiDetails: [],
            };
            await saveAppData(defaults);
            setAssets(defaults.assets);
            setDeliverables(defaults.deliverables);
            setDeliverableSegments(defaults.deliverableSegments);
            setInitiatives(defaults.initiatives);
            setMilestones(defaults.milestones);
            setProgrammes(defaults.programmes);
            setStrategies(defaults.strategies);
            setDependencies(defaults.dependencies);
            setAssetCategories(defaults.assetCategories);
            setTimelineSettings(defaults.timelineSettings);
            setResources(defaults.resources);
            setDeliverableStatuses(defaults.deliverableStatuses);
            setDecisions(defaults.decisions);
            setRptiDetails(defaults.rptiDetails);
            setLkptiDetails(defaults.lkptiDetails);
          } else {
            // First real run: let the user pick a template. A workspace with no current
            // records can still hold a decision log; the picker offers to back it up.
            setDecisions((dbData as any).decisions || []);
            setShowTemplatePicker(true);
          }
        } else {
          // A workspace saved before ADR-0013 holds the eight application attributes on
          // its LKPTI rows and `remarks` on its RPTI rows, where nothing now reads them.
          // IndexedDB keeps them (it is schemaless within a store), so they are still
          // recoverable — but only until the first press of Generate rebuilds the rows
          // from the deliverable and discards them for good. Lift on load, ahead of that.
          // See requirement-specs/report-rows-as-projections.md Q4 and FR-019.
          const lifted = liftReportRowAttributes({
            deliverables: dbData.deliverables || [],
            deliverableSegments: (dbData as any).deliverableSegments || [],
            deliverableStatuses: (dbData as any).deliverableStatuses || [],
            initiatives: dbData.initiatives || [],
            lkptiDetails: (dbData as any).lkptiDetails || [],
            rptiDetails: (dbData as any).rptiDetails || [],
          });
          const liftedInitiatives = lifted.initiatives.map(i => ({
            ...i, capex: Number(i.capex) || 0, opex: Number(i.opex) || 0,
          }));

          // Persist the lift immediately. In particular, removing legacy cost
          // properties is the one-time migration marker: without this save a later
          // reload could treat the same stale row as authoritative again and undo a
          // preparer's newer Initiative edit (F3 / design Q7).
          if (lifted.changed) {
            await saveAppData({
              ...dbData,
              deliverables: lifted.deliverables,
              deliverableSegments: lifted.deliverableSegments,
              initiatives: liftedInitiatives,
              rptiDetails: lifted.rptiDetails,
            });
          }

          setAssets(dbData.assets);
          setDeliverables(lifted.deliverables);
          setDeliverableSegments(lifted.deliverableSegments);
          setInitiatives(liftedInitiatives);
          setMilestones(dbData.milestones);
          setProgrammes(dbData.programmes);
          setStrategies(dbData.strategies || []);
          setDependencies(dbData.dependencies || []);
          setAssetCategories(dbData.assetCategories || []);
          setResources(dbData.resources || []);
          setDeliverableStatuses((dbData as any).deliverableStatuses || []);
          setDecisions((dbData as any).decisions || []);
          setRptiDetails(lifted.rptiDetails);
          setLkptiDetails((dbData as any).lkptiDetails || []);
          const mergedSettings = presentSettings(dbData.timelineSettings as TimelineSettings);
          setTimelineSettings(mergedSettings);

          if (!mergedSettings.hasSeenTutorial && !localStorage.getItem('scenia-e2e')) {
            setShowTutorial(true);
          }
        }
        // The stored base Undo/Redo compares against, after any load-time writes above.
        lastPersistedRef.current = await readPersistedWorkspace();
      } catch (error) {
        console.error('Failed to load data from DB:', error);
        // Fallback to initial data
        setAssets(initialAssets);
        setDeliverables(initialDeliverables);
        setDeliverableSegments(initialDeliverableSegments);
        setInitiatives(initialInitiatives);
        setMilestones(initialMilestones);
        setProgrammes(initialProgrammes);
        setStrategies(initialStrategies);
        setDependencies(initialDependencies);
        setAssetCategories(initialAssetCategories);
        setTimelineSettings(defaultTimelineSettings);
        setResources(initialResources);
        setDeliverableStatuses(initialDeliverableStatuses);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const handleSelectTemplate = useCallback(async (templateId: TemplateId, withDemoData: boolean) => {
    const data = getTemplateData(templateId, withDemoData);
    // Choosing a template is not the confirmation: with anything to lose, the
    // preview says what goes before anything is written (R04).
    const result = await requestReplacement({
      title: 'Replace your workspace?',
      message: 'Starting again replaces everything in this browser — records, History and the decision log — with the template you chose.',
      confirmLabel: 'Replace workspace',
      // Establishes a new workspace, so resetting the decision log is correct:
      // its records reference entity IDs that no longer exist (ADR-0011).
      next: () => ({ ...data, versions: [] }),
      notices: [],
      undoable: false,
      onCommitted: () => {
        setShowTemplatePicker(false);
        setTemplatePickerIsReset(false);
        if (!data.timelineSettings.hasSeenTutorial && !localStorage.getItem('scenia-e2e')) {
          setShowTutorial(true);
        }
      },
    }, false);
    if (result.status === 'failed') setDbSaveError(`The template was not applied: ${result.message}`);
  }, [requestReplacement]);

  /**
   * Onboarding from filed returns (specs/001-rpti-import-onboarding).
   *
   * LKPTI first, always: it establishes what the bank actually runs, so the plan
   * can be read against a known inventory rather than two unknown lists being
   * merged into each other. The RPTI is optional — a bank may only have last
   * year's inventory to hand.
   *
   * Each return carries its own reporting year. An inventory *as at* 2026 beside
   * a plan *for* 2027 is the normal pairing, and neither layout carries a year,
   * so neither can be inferred.
   *
   * Everything is persisted in one conditional write. There is no staging area:
   * an import that is refused, cancelled at its preview, or fails to save leaves
   * the workspace untouched.
   */
  const handleImportReturns = useCallback(async (request: OnboardingImportRequest) => {
    const lk = await parseLkptiImportFile(request.lkptiFile);
    if (lk.rows.length === 0) {
      throw new Error(lk.skipped.length > 0
        ? `No rows could be imported — every row had a problem (e.g. row ${lk.skipped[0].rowNumber}: ${lk.skipped[0].reason}).`
        : 'No data rows found in this LKPTI file.');
    }
    const lkDerived = deriveWorkspaceFromLkptiImport(lk.rows, request.lkptiYear);

    let rpDerived: ReturnType<typeof deriveWorkspaceFromRptiImport> | null = null;
    let rpSkipped: { rowNumber: number; reason: string }[] = [];
    let rpRowCount = 0;
    if (request.rptiFile && request.rptiYear) {
      const rp = await parseRptiImportFile(request.rptiFile);
      rpSkipped = rp.skipped;
      rpRowCount = rp.rows.length;
      rpDerived = deriveWorkspaceFromRptiImport(rp.rows, request.rptiYear, {
        deliverables: lkDerived.deliverables,
        assets: lkDerived.assets,
        assetCategories: lkDerived.assetCategories,
        // So an upgrade attaching to an application the LKPTI already supplied does
        // not get a second, redundant live period drawn inside the first.
        deliverableSegments: lkDerived.deliverableSegments,
        deliverableStatuses: lkDerived.deliverableStatuses,
      });
    }

    const blank = getTemplateData('lkpti-import', false);
    const data: AppState = {
      ...blank,
      assetCategories: [...lkDerived.assetCategories, ...(rpDerived?.assetCategories ?? [])],
      assets: [...lkDerived.assets, ...(rpDerived?.assets ?? [])],
      // The RPTI can answer the related-party question for an application the LKPTI
      // created, so its patches to existing deliverables are merged in by id. Without
      // this the filed answer is lost on every upgrade that matched (ADR-0013).
      deliverables: [
        ...lkDerived.deliverables.map(d => rpDerived?.updatedDeliverables.find(u => u.id === d.id) ?? d),
        ...(rpDerived?.deliverables ?? []),
      ],
      deliverableSegments: [...lkDerived.deliverableSegments, ...(rpDerived?.deliverableSegments ?? [])],
      deliverableStatuses: mergeDeliverableStatuses(lkDerived.deliverableStatuses, rpDerived?.deliverableStatuses),
      initiatives: rpDerived?.initiatives ?? [],
      programmes: rpDerived?.programmes ?? [],
      rptiDetails: rpDerived?.rptiDetails ?? [],
      lkptiDetails: lkDerived.lkptiDetails,
      // Keep the years the preparer stated, so Reports can offer them back rather than
      // reaching for the clock (T031/FR-009). Until now they positioned the imported
      // segments and then survived only as banner text. They go into `data` rather than
      // into a later setState because `saveAppData(data)` below is what persists them —
      // set afterwards, they would live until the next reload and no longer.
      timelineSettings: {
        ...blank.timelineSettings,
        onboardingLkptiYear: request.lkptiYear,
        ...(request.rptiYear ? { onboardingRptiYear: request.rptiYear } : {}),
      },
      versions: [],
    };

    const skipped = [...lk.skipped, ...rpSkipped];
    const unresolved = rpDerived?.unresolved.length ?? 0;
    // Parsed and derived first; replacing an existing workspace is then previewed
    // with what the returns produced (R05). Establishes a new workspace, so the
    // decision log and History reset (ADR-0011).
    const result = await requestReplacement({
      title: 'Replace your workspace?',
      message: 'Starting from these filed returns replaces everything in this browser — records, History and the decision log.',
      confirmLabel: 'Replace workspace',
      next: () => data,
      notices: [
        `LKPTI ${request.lkptiYear}: ${lk.rows.length} row(s)${request.rptiYear ? ` · RPTI ${request.rptiYear}: ${rpRowCount} row(s)` : ' · no RPTI supplied'}.`,
        skipped.length === 0 ? 'No rows were skipped.' : `${skipped.length} row(s) skipped — e.g. row ${skipped[0].rowNumber}: ${skipped[0].reason}`,
        ...(unresolved > 0 ? [`${unresolved} planned upgrade(s) reference an application not in the inventory; they will be listed in the data-health review.`] : []),
      ],
      undoable: false,
      onCommitted: () => {
        setImportSummary({
          lkptiYear: request.lkptiYear,
          rptiYear: request.rptiYear,
          lkptiRows: lk.rows.length,
          rptiRows: rpRowCount,
          skipped,
          unresolved,
        });
        setShowTemplatePicker(false);
        setTemplatePickerIsReset(false);
        // FR-022: land on the data-health review, so the first thing seen after an
        // import is what needs attention.
        setInitialReport('data-health');
        setView('reports');
      },
    }, false);
    if (result.status === 'failed') throw new Error(`The import was not saved: ${result.message}`);
  }, [requestReplacement]);

  const handleUpdate = useCallback(async (data: AppState, skipHistory = false): Promise<boolean> => {
    // A replacement is saving: an edit now could be overwritten by it, or overwrite it (X06).
    if (operationRef.current) {
      setDbSaveError('Wait for the current change to finish saving, then try again.');
      return false;
    }
    if (!skipHistory) {
      setUndoStack(prev => {
        // An update that replaces History records the History it replaced, so Undo
        // restores it (#62). Ordinary edits leave History alone and must not rewind it.
        const snapshot = getCurrentStateRef.current();
        const newStack = [...prev, data.versions ? { ...snapshot, versions: versionsRef.current } : snapshot];
        if (newStack.length > 10) return newStack.slice(newStack.length - 10);
        return newStack;
      });
      setRedoStack([]);
    }
    // Update state immediately for UI responsiveness
    publishState(data);
    if (data.versions) setVersions(data.versions);
    // Any open replacement preview was prepared against the old state (X03).
    bumpRevision();

    // Persist to DB
    try {
      await saveAppData(data).then(() => rememberStored(data, data.versions));
      notifySaved();
      return true;
    } catch (error) {
      console.error('Failed to save data to DB:', error instanceof Error ? `${error.name}: ${error.message}` : error);
      setDbSaveError(error instanceof DatabaseSupersededError
        ? error.message
        : 'Failed to save changes. Your data may not persist after a reload. If this keeps happening, try refreshing the page.');
      return false;
    }
  }, [publishState, bumpRevision, rememberStored, notifySaved]);

  const handleViewerImport = useCallback(async (file: File) => {
    try {
      const { data: imported, notices } = await importFromExcelWithDiagnostics(file);
      const hasData = Object.values(imported).some(arr => Array.isArray(arr) && arr.length > 0);
      if (!hasData) {
        setDbSaveError('No valid data found in the Excel file.');
        return;
      }

      const schemaIssues = validateImportSchema(imported as Record<string, unknown[]>);
      const errorIssues = schemaIssues.filter(issue => issue.severity === 'error');
      if (errorIssues.length > 0) {
        const preview = errorIssues.slice(0, 3).map(issue => `${issue.entity}: ${issue.issue}`).join('; ');
        const moreText = errorIssues.length > 3 ? ` (and ${errorIssues.length - 3} more)` : '';
        setDbSaveError(`Viewer import failed validation: ${preview}${moreText}`);
        return;
      }

      const blank = getTemplateData('viewer', false);
      const importedData: AppState = {
        assetCategories: imported.assetCategories ?? blank.assetCategories,
        assets: imported.assets ?? blank.assets,
        initiatives: imported.initiatives ?? blank.initiatives,
        milestones: imported.milestones ?? blank.milestones,
        deliverableSegments: imported.deliverableSegments ?? blank.deliverableSegments,
        programmes: imported.programmes ?? blank.programmes,
        strategies: imported.strategies ?? blank.strategies,
        dependencies: imported.dependencies ?? blank.dependencies,
        resources: imported.resources ?? blank.resources,
        deliverables: imported.deliverables ?? blank.deliverables,
        deliverableStatuses: imported.deliverableStatuses ?? blank.deliverableStatuses,
        // Establishes a new workspace, so resetting the decision log is correct:
        // its records reference entity IDs that no longer exist (ADR-0011).
        decisions: imported.decisions ?? blank.decisions,
        rptiDetails: imported.rptiDetails ?? blank.rptiDetails,
        lkptiDetails: imported.lkptiDetails ?? blank.lkptiDetails,
        timelineSettings: { ...blank.timelineSettings, ...(imported.timelineSettings ?? {}) },
        versions: imported.versions ?? [],
      };
      // Exported workbooks cannot be migrated while they remain on someone else's
      // disk; importing one is the boundary where its old row shape becomes reachable.
      const data = liftWorkspaceReportAttributes(importedData);

      // Nothing to lose on an empty workspace; otherwise say what will be replaced
      // and let the planner back out (#62). One Undo reverses it, History included.
      const result = await requestReplacement({
        title: 'Replace your workspace?',
        message: `Opening "${file.name}" replaces everything in this browser. You can undo straight afterwards, but not after a reload, so download a backup first if you might need the current workspace.`,
        confirmLabel: 'Replace workspace',
        next: () => data,
        notices: [
          ...(imported.decisions === undefined ? ['The file has no Decisions sheet, so the decision log starts empty.'] : []),
          ...notices,
        ],
        undoable: true,
        onCommitted: () => {
          setShowTemplatePicker(false);
          setTemplatePickerIsReset(false);
        },
      }, false);
      if (result.status === 'failed') setDbSaveError(`The file was not opened: ${result.message}`);
    } catch (error) {
      console.error('Viewer import failed:', error instanceof Error ? `${error.name}: ${error.message}` : error);
      setDbSaveError('Failed to import the file. Please check it is a valid Selara Excel export.');
    }
  }, [requestReplacement]);

  /**
   * Restore Backup (R01): only a complete backup is accepted, and it is always
   * previewed — even into an empty workspace — before anything is written.
   * Incomplete files are sent to ordinary Import, which alone may repair.
   * Rejects with a message for the planner; nothing changes on any refusal.
   */
  const handleRestoreBackupFile = useCallback(async (file: File) => {
    let workbook: Awaited<ReturnType<typeof readWorkbookFile>>;
    try {
      workbook = await readWorkbookFile(file);
    } catch {
      throw new Error(`"${file.name}" can't be read as a spreadsheet, so nothing was restored.`);
    }
    const result = readBackupWorkbook(workbook);
    const listed = (problems: string[]) => `${problems.slice(0, 3).join(' ')}${problems.length > 3 ? ` (and ${problems.length - 3} more)` : ''}`;
    if (result.status === 'rejected') {
      throw new Error(`"${file.name}" can't be restored, and nothing was changed. ${listed(result.problems)}`);
    }
    if (result.status === 'incomplete') {
      throw new Error(`"${file.name}" isn't a complete backup, so Restore won't use it. ${listed(result.problems)} To bring in what it does contain, use Import instead: it previews what it can read, and any repairs, before anything changes.`);
    }
    const backedUpAt = result.exportedAt && !Number.isNaN(Date.parse(result.exportedAt))
      ? ` (backed up ${new Date(result.exportedAt).toLocaleString()})` : '';
    const outcome = await requestReplacement({
      title: 'Restore backup?',
      message: `Restoring "${file.name}"${backedUpAt} replaces this workspace — records, History, the decision log and settings — with the backup's contents.`,
      confirmLabel: 'Restore backup',
      next: () => ({ ...result.workspace }),
      notices: result.notices,
      undoable: true,
      successNotice: `Backup restored from "${file.name}".`,
      onCommitted: () => {
        setShowTemplatePicker(false);
        setTemplatePickerIsReset(false);
      },
    }, true);
    if (outcome.status === 'failed') throw new Error(`Nothing was restored: ${outcome.message}`);
  }, [requestReplacement]);

  /** A coherent, saved workspace for Backup, after every pending save has landed (X01/X02). */
  const handlePrepareBackup = useCallback(async () => toPortable((await prepareOperation()).stored), [prepareOperation]);

  /**
   * An incoming share link (R06). Outbound sharing stays disabled; this protects
   * the link a planner might still open. Decrypted and validated first, then
   * always previewed. A link without History leaves the saved versions alone.
   */
  const handleIncomingShare = useCallback(async ({ id, key }: { id: string; key: string }) => {
    const clearLink = () => window.history.replaceState({}, document.title, window.location.pathname);
    setIsImportingShare(true);
    let imported: AppState;
    try {
      const payload = await importSharedWorkspace(id, key);
      if (!isValidSharedAppState(payload)) throw new Error('Shared workspace data is invalid or incomplete.');
      imported = payload;
    } catch (error) {
      console.error('Failed to import shared workspace:', error);
      setDbSaveError(error instanceof Error ? error.message : 'Failed to import shared workspace.');
      clearLink();
      return;
    } finally {
      setIsImportingShare(false);
    }
    // A share can have been created before ADR-0013. Lift before the imported
    // workspace reaches live state, and persist the lifted form in the same write.
    const shared = liftWorkspaceReportAttributes(imported);
    const result = await requestReplacement({
      title: 'Open shared link?',
      message: 'This share link will replace your current local workspace.',
      confirmLabel: 'Replace workspace',
      next: () => ({ ...shared, versions: imported.versions }),
      notices: imported.versions ? [] : ['This link carries no History, so your saved versions stay as they are.'],
      undoable: true,
      onCommitted: clearLink,
      onCancelled: clearLink,
    }, true);
    if (result.status === 'failed') {
      setDbSaveError(`The shared link was not opened: ${result.message}`);
      clearLink();
    }
  }, [requestReplacement]);

  useEffect(() => {
    if (isLoading || !incomingShare) return;
    setIncomingShare(null);
    void handleIncomingShare(incomingShare);
  }, [isLoading, incomingShare, handleIncomingShare]);

  const handleSaveVersion = useCallback(async (version: Version): Promise<boolean> => {
    if (operationRef.current) {
      setDbSaveError('Wait for the current change to finish saving, then try again.');
      return false;
    }
    try {
      await saveVersion(version);
    } catch (error) {
      console.error('Failed to save version:', error);
      setDbSaveError(`The version could not be saved (${describeError(error)}). Nothing was added to History.`);
      return false;
    }
    setVersions(prev => [...prev, version]);
    if (lastPersistedRef.current) lastPersistedRef.current = { ...lastPersistedRef.current, versions: [...lastPersistedRef.current.versions, version] };
    bumpRevision();
    notifySaved();
    return true;
  }, [bumpRevision, notifySaved]);

  const handleDeleteVersion = useCallback(async (id: string): Promise<boolean> => {
    if (operationRef.current) {
      setDbSaveError('Wait for the current change to finish saving, then try again.');
      return false;
    }
    try {
      await deleteVersion(id);
    } catch (error) {
      console.error('Failed to delete version:', error);
      setDbSaveError(`The version could not be deleted (${describeError(error)}). History is unchanged.`);
      return false;
    }
    setVersions(prev => prev.filter(v => v.id !== id));
    if (lastPersistedRef.current) lastPersistedRef.current = { ...lastPersistedRef.current, versions: lastPersistedRef.current.versions.filter(v => v.id !== id) };
    bumpRevision();
    notifySaved();
    return true;
  }, [bumpRevision, notifySaved]);

  const handleRepairUnresolvedRow = useCallback(async (request: UnresolvedRowRepairRequest) => {
    const result = applyUnresolvedRowRepair(getCurrentStateRef.current(), request);
    if (result.ok) await handleUpdate(result.state);
    return result;
  }, [handleUpdate]);

  // FR-018a: extending a stale prior phase is one undoable change, like any other edit.
  const handleExtendImportPriorPhase = useCallback(async (segmentId: string) => {
    await handleUpdate(extendImportPriorPhase(getCurrentStateRef.current(), segmentId));
  }, [handleUpdate]);

  // Reloads full state from IndexedDB in response to another tab's save (see
  // requirement-specs/cross-tab-sync.md). Unlike handleUpdate, this never re-saves
  // (the source tab already did) and never pushes onto the undo stack — instead it
  // clears both stacks, since their snapshots no longer correspond to the DB's
  // current baseline once a remote change has landed.
  //
  // History comes with it, read in the same transaction (X04/X08). A read that a
  // newer read, or a commit from this tab, has overtaken is not published: it
  // would put older data on screen over newer. The overtaken case reads again.
  const applyRemoteSyncRef = useRef<() => Promise<void>>(async () => {});
  const applyRemoteSync = useCallback(async () => {
    const request = ++syncRequestRef.current;
    const localCommitsAtStart = localCommitRef.current;
    let stored: PersistedWorkspace;
    try {
      stored = await readPersistedWorkspace();
    } catch (error) {
      console.error('Failed to reload data for cross-tab sync:', error instanceof Error ? `${error.name}: ${error.message}` : error);
      return;
    }
    if (request !== syncRequestRef.current) return;
    if (localCommitsAtStart !== localCommitRef.current) {
      void applyRemoteSyncRef.current();
      return;
    }
    publishState(presentStored(stored));
    setVersions(stored.versions);
    lastPersistedRef.current = stored;
    bumpRevision();

    setUndoStack([]);
    setRedoStack([]);

    // Close a decision panel left open on a decision the remote change deleted.
    setSelectedDecisionId(prev => (prev && !stored.decisions.some(d => d.id === prev) ? null : prev));

    setSyncToast('Updated in another tab');
    if (syncToastTimerRef.current) clearTimeout(syncToastTimerRef.current);
    syncToastTimerRef.current = setTimeout(() => setSyncToast(null), 4000);
  }, [publishState, bumpRevision]);
  applyRemoteSyncRef.current = applyRemoteSync;

  useEffect(() => {
    const channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
    syncChannelRef.current = channel;
    channel.onmessage = (event) => {
      if (isRemoteSaveMessage(event.data, tabIdRef.current)) {
        applyRemoteSync();
      }
    };
    return () => {
      channel.close();
      syncChannelRef.current = null;
      if (syncToastTimerRef.current) clearTimeout(syncToastTimerRef.current);
    };
  }, [applyRemoteSync]);

  /**
   * Undo and Redo of any entry, replacements included (R08). A direct action — no
   * confirmation — but persisted like a replacement: it waits for queued saves,
   * writes only if the store still holds what this tab last stored (so a change
   * from another tab is not overwritten), and moves the stacks only after the
   * write succeeds. A failure leaves both stacks as they were, ready to retry.
   */
  const runStackStep = useCallback(async (direction: 'undo' | 'redo') => {
    const from = direction === 'undo' ? undoStack : redoStack;
    if (from.length === 0 || operationRef.current) return;
    const target = from[from.length - 1];
    // With History when the entry carries it, so the opposite step can put it back.
    const onScreen = target.versions ? { ...getCurrentStateRef.current(), versions: versionsRef.current } : getCurrentStateRef.current();
    const label = direction === 'undo' ? 'Undo' : 'Redo';
    operationRef.current = true;
    setBusyMessage(direction === 'undo' ? 'Undoing…' : 'Redoing…');
    try {
      await settleWrites();
      const base = lastPersistedRef.current;
      if (!base) throw new Error('the stored workspace has not been read yet');
      await replaceWorkspace(target, workspaceFingerprint(base), workspaceFingerprint);
    } catch (error) {
      setDbSaveError(error instanceof StaleWorkspaceError
        ? `${label} was not applied: the workspace changed in another tab. Nothing was changed.`
        : `${label} failed (${describeError(error)}). Nothing was changed, and you can try again.`);
      return;
    } finally {
      operationRef.current = false;
      setBusyMessage(null);
    }
    const push = (stack: AppState[]) => [...stack, onScreen].slice(-10);
    if (direction === 'undo') {
      setUndoStack(prev => prev.slice(0, -1));
      setRedoStack(push);
    } else {
      setRedoStack(prev => prev.slice(0, -1));
      setUndoStack(push);
    }
    publishState(target);
    if (target.versions) setVersions(target.versions);
    rememberStored(target, target.versions);
    bumpRevision();
    notifySaved();
    setDbSaveError(null);
  }, [undoStack, redoStack, publishState, rememberStored, bumpRevision, notifySaved]);

  const handleUndo = useCallback(() => { void runStackStep('undo'); }, [runStackStep]);
  const handleRedo = useCallback(() => { void runStackStep('redo'); }, [runStackStep]);

  // Keep refs pointing to latest callbacks so the keyboard listener never needs to re-register
  undoRef.current = handleUndo;
  redoRef.current = handleRedo;
  getCurrentStateRef.current = getCurrentState;

  const handleAddInitiative = useCallback((newInit: Initiative) => {
    if (initiatives.some(i => i.id === newInit.id)) return;
    handleUpdate({ assets, deliverables, deliverableSegments, initiatives: [...initiatives, newInit], milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails });
  }, [assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails, handleUpdate]);

  const handleUpdateInitiative = useCallback((updatedInit: Initiative) => {
    handleUpdate({ assets, deliverables, deliverableSegments, initiatives: initiatives.map(i => i.id === updatedInit.id ? updatedInit : i), milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails });
  }, [assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails, handleUpdate]);

  const handleUpdateAssets = useCallback((updatedAssets: Asset[]) => {
    handleUpdate({ assets: updatedAssets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails });
  }, [deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails, handleUpdate]);

  const handleUpdateAsset = useCallback((updatedAsset: Asset) => {
    handleUpdate({ assets: assets.map(a => a.id === updatedAsset.id ? updatedAsset : a), deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails });
  }, [assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails, handleUpdate]);

  const handleNavigateFromHealthIssue = useCallback((location: HealthIssueLocation, entityName: string) => {
    setSearchQuery(entityName);
    if (location.view === 'history') {
      setView('history');
    } else {
      setDataManagerInitialTab(location.tab);
      setView('data');
    }
  }, []);

  const handleUpdateDependencies = useCallback((updatedDependencies: Dependency[]) => {
    handleUpdate({ assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies: updatedDependencies, assetCategories, timelineSettings, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails });
  }, [assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, assetCategories, timelineSettings, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails, handleUpdate]);

  const handleUpdateMilestone = useCallback((updatedMilestone: Milestone) => {
    handleUpdate({ assets, deliverables, deliverableSegments, initiatives, milestones: milestones.map(m => m.id === updatedMilestone.id ? updatedMilestone : m), programmes, strategies, dependencies, assetCategories, timelineSettings, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails });
  }, [assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails, handleUpdate]);

  const handleDeleteInitiative = useCallback((deletedInit: Initiative) => {
    handleUpdate({ assets, deliverables, deliverableSegments, initiatives: initiatives.filter(i => i.id !== deletedInit.id), milestones, programmes, strategies, dependencies: dependencies.filter(d => d.sourceId !== deletedInit.id && d.targetId !== deletedInit.id), assetCategories, timelineSettings, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails });
  }, [assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails, handleUpdate]);

  const handleUpdateSettings = useCallback((updatedSettings: TimelineSettings) => {
    handleUpdate({ assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings: updatedSettings, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails });
  }, [assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails, handleUpdate]);

  /**
   * History restore (R07): rolls plan data back within the same workspace, so
   * saved versions and the live decision log are kept (ADR-0011). A damaged
   * snapshot is refused before anything is written.
   */
  const handleRequestRestore = useCallback(async (version: Version) => {
    const problem = snapshotProblem(version);
    if (problem) {
      setDbSaveError(`"${version.name}" can't be restored: ${problem} Nothing was changed.`);
      return;
    }
    const result = await requestReplacement({
      title: 'Restore Version',
      message: `Restore "${version.name}"? This will overwrite all your current work. Your decision log is not rolled back.`,
      confirmLabel: 'Restore',
      // A pre-ADR-0013 snapshot can reintroduce legacy row properties after the live
      // workspace was already migrated. Lift before it becomes live: restore followed
      // immediately by Generate must file the lifted values, without relying on reload.
      // The same write persists the cleaned rows, making the removed legacy cost
      // properties the durable one-time migration marker (F3/Q7).
      next: current => liftWorkspaceReportAttributes(buildRestoredWorkspace(version, current.decisions) as AppState),
      notices: [],
      undoable: true,
      // The old modal closed itself and dropped you back on the timeline so you
      // could see the restored state; the guide documents that.
      onCommitted: () => setView('visualiser'),
    }, true);
    if (result.status === 'failed') setDbSaveError(`The version was not restored: ${result.message}`);
  }, [requestReplacement]);

  const handleSaveDeliverableSegment = useCallback((seg: import('./types').DeliverableSegment) => {
    const exists = deliverableSegments.some(s => s.id === seg.id);
    const savedSeg = exists ? seg : { ...seg, id: `seg-${Date.now()}` };
    const next = exists ? deliverableSegments.map(s => s.id === seg.id ? savedSeg : s) : [...deliverableSegments, savedSeg];
    handleUpdate({ assets, deliverables, deliverableSegments: next, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails });
  }, [assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails, handleUpdate]);

  const handleDeleteDeliverableSegment = useCallback((seg: import('./types').DeliverableSegment) => {
    handleUpdate({ assets, deliverables, deliverableSegments: deliverableSegments.filter(s => s.id !== seg.id), initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails });
  }, [assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails, handleUpdate]);

  const handleUpdateDeliverableSegments = useCallback((segs: import('./types').DeliverableSegment[]) => {
    handleUpdate({ assets, deliverables, deliverableSegments: segs, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails });
  }, [assets, deliverables, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails, handleUpdate]);

  const handleDeleteAsset = useCallback((assetId: string) => {
    const assetAppIds = new Set(deliverables.filter(a => a.assetId === assetId).map(a => a.id));
    handleUpdate({
      assets: assets.filter(a => a.id !== assetId),
      deliverables: deliverables.filter(a => a.assetId !== assetId),
      deliverableSegments: deliverableSegments.filter(s => !assetAppIds.has(s.deliverableId)),
      initiatives: initiatives.filter(i => i.assetId !== assetId),
      milestones: milestones.filter(m => m.assetId !== assetId),
      programmes, strategies,
      dependencies: dependencies.filter(d => {
        const deletedInitIds = new Set(initiatives.filter(i => i.assetId === assetId).map(i => i.id));
        return !deletedInitIds.has(d.sourceId) && !deletedInitIds.has(d.targetId);
      }),
      assetCategories, timelineSettings, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails,
    });
  }, [assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails, handleUpdate]);

  const handleBulkDeleteAssets = useCallback((assetIds: string[]) => {
    const idSet = new Set(assetIds);
    const assetAppIds = new Set(
      deliverables.filter(a => idSet.has(a.assetId)).map(a => a.id)
    );
    const deletedInitIds = new Set(
      initiatives.filter(i => idSet.has(i.assetId)).map(i => i.id)
    );
    handleUpdate({
      assets: assets.filter(a => !idSet.has(a.id)),
      deliverables: deliverables.filter(a => !idSet.has(a.assetId)),
      deliverableSegments: deliverableSegments.filter(s => !assetAppIds.has(s.deliverableId)),
      initiatives: initiatives.filter(i => !idSet.has(i.assetId)),
      milestones: milestones.filter(m => !idSet.has(m.assetId)),
      programmes, strategies,
      dependencies: dependencies.filter(d =>
        !deletedInitIds.has(d.sourceId) && !deletedInitIds.has(d.targetId)
      ),
      assetCategories, timelineSettings, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails,
    });
  }, [assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails, handleUpdate]);

  const handleAddAssets = useCallback((newAssets: Asset[]) => {
    // Skip any assets already present (matched by externalId to prevent duplicates)
    const existingExternalIds = new Set(assets.map(a => a.externalId).filter(Boolean));
    const toAdd = newAssets.filter(a => !a.externalId || !existingExternalIds.has(a.externalId));
    if (toAdd.length === 0) return;

    // Bring the catalogue's own category along if the workspace hasn't got it.
    // These assets carry a `cat-rpti-NN` categoryId, which previously only existed
    // because the catalogue was reachable solely from the RPTI template — that
    // template seeds them. Now that a blank workspace surfaces the catalogue too
    // (#38), adding an area without its category would create orphaned assets
    // that render nowhere and trip dataHealth's dangling-category check.
    const existingCategoryIds = new Set(assetCategories.map(c => c.id));
    const missingCategories = rptiCatalogueAssetCategories.filter(
      c => !existingCategoryIds.has(c.id) && toAdd.some(a => a.categoryId === c.id),
    );

    handleUpdate({ assets: [...assets, ...toAdd], deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories: [...assetCategories, ...missingCategories], timelineSettings, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails });
  }, [assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails, handleUpdate]);

  const handleAddDecision = useCallback((newDecision: Decision) => {
    handleUpdate({ assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, deliverableStatuses, decisions: [...decisions, newDecision], rptiDetails, lkptiDetails });
  }, [assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails, handleUpdate]);

  const handleUpdateDecision = useCallback((updatedDecision: Decision) => {
    handleUpdate({ assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, deliverableStatuses, decisions: decisions.map(d => d.id === updatedDecision.id ? updatedDecision : d), rptiDetails, lkptiDetails });
  }, [assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails, handleUpdate]);

  const handleDeleteDecision = useCallback((deletedDecision: Decision) => {
    handleUpdate({ assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, deliverableStatuses, decisions: decisions.filter(d => d.id !== deletedDecision.id), rptiDetails, lkptiDetails });
  }, [assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails, handleUpdate]);

  const handleOpenDecision = useCallback((decisionId: string) => {
    setSelectedDecisionId(decisionId);
    setView('history');
  }, []);

  useEffect(() => {
    if (!showMoreSettingsPanel && !showViewOptionsPanel) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (showMoreSettingsPanel && moreSettingsPanelRef.current && !moreSettingsPanelRef.current.contains(e.target as Node)) {
        setShowMoreSettingsPanel(false);
      }
      if (showViewOptionsPanel && viewOptionsPanelRef.current && !viewOptionsPanelRef.current.contains(e.target as Node)) {
        setShowViewOptionsPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMoreSettingsPanel, showViewOptionsPanel]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Escape') {
        setShowShortcuts(false);
      }

      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'z') {
          e.preventDefault();
          undoRef.current();
        } else if (e.key === 'Z' || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault();
          redoRef.current();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-2 text-slate-500">
          <Loader2 className="animate-spin" size={32} />
          <p>Loading data...</p>
          {storageState === 'blocked' && (
            <p data-testid="storage-upgrade-blocked" role="status" className="max-w-sm text-center text-sm text-slate-600">
              Selara is updating how it stores your data. Close or reload your other Selara tabs to continue — this page carries on by itself.
            </p>
          )}
        </div>

      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-slate-100 p-3 md:p-6 flex flex-col">
      <span hidden data-testid="app-ready" />
      {storageState === 'superseded' && (
        <div
          data-testid="storage-superseded"
          role="alert"
          className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900 flex-shrink-0"
        >
          <span className="flex-1">Selara was updated in another tab. Reload this tab to continue; until then, changes here can't be saved.</span>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1 rounded-lg bg-amber-600 text-white text-xs font-medium hover:bg-amber-700"
          >Reload</button>
        </div>
      )}
      {dbSaveError && (
        <div
          data-testid="db-error-banner"
          className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800 flex-shrink-0"
        >
          <span className="flex-1">{dbSaveError}</span>
          <button
            onClick={() => setDbSaveError(null)}
            className="text-red-500 hover:text-red-700 font-bold text-lg leading-none"
            title="Dismiss"
          >×</button>
        </div>
      )}
      {workspaceNotice && (
        <div
          data-testid="workspace-notice"
          role="status"
          className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800 flex-shrink-0"
        >
          <span className="flex-1">{workspaceNotice}</span>
          <button
            onClick={() => setWorkspaceNotice(null)}
            className="text-emerald-600 hover:text-emerald-800 font-bold text-lg leading-none"
            title="Dismiss"
          >×</button>
        </div>
      )}
      {syncToast && (
        <div
          data-testid="sync-toast"
          className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800 flex-shrink-0"
        >
          <span className="flex-1">{syncToast}</span>
          <button
            onClick={() => setSyncToast(null)}
            className="text-blue-500 hover:text-blue-700 font-bold text-lg leading-none"
            title="Dismiss"
          >×</button>
        </div>
      )}
      <header className="mb-4 flex-shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm">

        {/* ── Mobile header ── */}
        <div data-testid="mobile-header" className="flex md:hidden items-center gap-3 px-4 py-2">
          <h1 className="text-lg font-bold text-slate-900 tracking-tight whitespace-nowrap">Selara</h1>
          <div className="flex-1" />
          <button
            data-testid="mobile-settings-btn"
            onClick={() => setShowMobileSheet(true)}
            className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
            title="Timeline settings"
          >
            <SlidersHorizontal size={16} />
          </button>
        </div>

        {/* ── Desktop header ── */}
        <div data-testid="desktop-header-controls" className="hidden md:flex flex-wrap items-center gap-3 px-4 py-2 overflow-x-auto">
        {/* Logo */}
        <h1 className="text-lg font-bold text-slate-900 tracking-tight whitespace-nowrap">Selara</h1>

        <div className="w-px h-6 bg-slate-200 shrink-0" />

        {/* View Toggle */}
        <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200 shrink-0">
          <button
            onClick={() => setView('visualiser')}
            data-testid="nav-visualiser"
            aria-pressed={view === 'visualiser'}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer",
              view === 'visualiser'
                ? "bg-white text-blue-700 shadow-sm ring-1 ring-blue-200"
                : "text-slate-600 hover:text-slate-800"
            )}
          >
            <LayoutGrid size={14} />
            Visualiser
          </button>
          <button
            onClick={() => setView('data')}
            data-testid="nav-data-manager"
            aria-pressed={view === 'data'}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer",
              view === 'data'
                ? "bg-white text-blue-700 shadow-sm ring-1 ring-blue-200"
                : "text-slate-600 hover:text-slate-800"
            )}
          >
            <Table size={14} />
            Data Manager
          </button>
          <button
            onClick={() => setView('reports')}
            data-testid="nav-reports"
            aria-pressed={view === 'reports'}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer",
              view === 'reports'
                ? "bg-white text-blue-700 shadow-sm ring-1 ring-blue-200"
                : "text-slate-600 hover:text-slate-800"
            )}
          >
            <BarChart2 size={14} />
            Reports
          </button>
          <button
            onClick={() => setView('history')}
            data-testid="nav-history"
            aria-pressed={view === 'history'}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer",
              view === 'history'
                ? "bg-white text-blue-700 shadow-sm ring-1 ring-blue-200"
                : "text-slate-600 hover:text-slate-800"
            )}
          >
            <ClipboardList size={14} />
            History
          </button>
          <button
            onClick={() => setView('guide')}
            data-testid="nav-guide"
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer",
              view === 'guide'
                ? "bg-white text-blue-700 shadow-sm ring-1 ring-blue-200"
                : "text-slate-600 hover:text-slate-800"
            )}
          >
            <BookOpen size={14} />
            Guide
          </button>
        </div>

        {/* Search */}
        <div className="relative w-44 shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            type="search"
            data-testid="search-input"
            placeholder="Search initiatives..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Workspace backup: in every view, with the workspace-wide controls rather than the view options and exports. */}
        <BackupControls onPrepareBackup={handlePrepareBackup} onRestoreBackup={handleRestoreBackupFile} />

        {view === 'visualiser' && <>
        <div className="w-px h-6 bg-slate-200 shrink-0" />

        {/* Timeline Range */}
        <label className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
          Start
          <input
            type="date"
            data-testid="timeline-start-input"
            value={timelineSettings.startDate}
            onChange={(e) => {
              handleUpdate({
                assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories,
                timelineSettings: { ...timelineSettings, startDate: e.target.value },
                resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails,
              });
            }}
            className="px-1.5 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
          Months
          <select
            data-testid="timeline-months-select"
            value={timelineSettings.monthsToShow || 36}
            onChange={(e) => {
              handleUpdate({
                assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories,
                timelineSettings: { ...timelineSettings, monthsToShow: parseInt(e.target.value) as 3 | 6 | 12 | 24 | 36 },
                resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails,
              });
            }}
            className="px-1.5 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="3">3</option>
            <option value="6">6</option>
            <option value="12">12</option>
            <option value="24">24</option>
            <option value="36">36</option>
          </select>
        </label>

        {/* Inline Display Toggles */}
        {(() => {
          const conflictsOn = (timelineSettings.conflictDetection || 'on') === 'on';
          const relationshipsOn = (timelineSettings.showRelationships || 'on') === 'on';
          const descriptionsOn = (timelineSettings.descriptionDisplay || 'off') === 'on';
          const budgetMode = timelineSettings.budgetVisualisation || 'off';
          const criticalPathOn = (timelineSettings.criticalPath || 'off') === 'on';
          const showResourcesOn = (timelineSettings.showResources || 'off') === 'on';
          const budgetCycle: Array<'off' | 'label' | 'bar-height'> = ['off', 'label', 'bar-height'];
          const nextBudget = budgetCycle[(budgetCycle.indexOf(budgetMode as 'off' | 'label' | 'bar-height') + 1) % 3];

          const toggleClass = (active: boolean) => cn(
            "p-1.5 rounded-md border transition-colors",
            active
              ? "bg-blue-50 border-blue-200 text-blue-600"
              : "bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          );

          return (
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                data-testid="toggle-conflicts"
                data-active={conflictsOn ? 'true' : 'false'}
                aria-label="Conflict Detection"
                aria-pressed={conflictsOn}
                onClick={() => handleUpdate({ assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings: { ...timelineSettings, conflictDetection: conflictsOn ? 'off' : 'on' }, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails })}
                className={toggleClass(conflictsOn)}
                title="Conflict Detection"
              >
                <AlertTriangle size={13} />
              </button>
              <button
                data-testid="toggle-relationships"
                data-active={relationshipsOn ? 'true' : 'false'}
                aria-label="Relationship Lines"
                aria-pressed={relationshipsOn}
                onClick={() => handleUpdate({ assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings: { ...timelineSettings, showRelationships: relationshipsOn ? 'off' : 'on' }, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails })}
                className={toggleClass(relationshipsOn)}
                title="Relationship Lines"
              >
                <GitBranch size={13} />
              </button>
              <button
                data-testid="toggle-descriptions"
                data-active={descriptionsOn ? 'true' : 'false'}
                aria-label="Descriptions"
                aria-pressed={descriptionsOn}
                onClick={() => handleUpdate({ assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings: { ...timelineSettings, descriptionDisplay: descriptionsOn ? 'off' : 'on' }, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails })}
                className={toggleClass(descriptionsOn)}
                title="Descriptions"
              >
                <AlignLeft size={13} />
              </button>
              <button
                data-testid="toggle-budget"
                data-mode={budgetMode}
                aria-label={`Budget visualisation: ${budgetMode}`}
                aria-pressed={budgetMode !== 'off'}
                onClick={() => handleUpdate({ assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings: { ...timelineSettings, budgetVisualisation: nextBudget }, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails })}
                className={toggleClass(budgetMode !== 'off')}
                title={`Budget: ${budgetMode}`}
              >
                <DollarSign size={13} />
              </button>
              <button
                data-testid="toggle-critical-path"
                data-active={criticalPathOn ? 'true' : 'false'}
                aria-label="Critical Path"
                aria-pressed={criticalPathOn}
                onClick={() => handleUpdate({ assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings: { ...timelineSettings, criticalPath: criticalPathOn ? 'off' : 'on' }, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails })}
                className={toggleClass(criticalPathOn)}
                title="Critical Path"
              >
                <GitCommit size={13} />
              </button>
              <button
                data-testid="toggle-resources"
                data-active={showResourcesOn ? 'true' : 'false'}
                aria-label="Show Resources"
                aria-pressed={showResourcesOn}
                onClick={() => handleUpdate({ assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings: { ...timelineSettings, showResources: showResourcesOn ? 'off' : 'on' }, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails })}
                className={toggleClass(showResourcesOn)}
                title="Show Resources"
              >
                <Users size={13} />
              </button>

              {/* Zoom controls */}
              {(() => {
                const ZOOM_STEPS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0];
                const currentZoom = timelineSettings.columnZoom ?? 1.0;
                const currentIdx = ZOOM_STEPS.findIndex(z => Math.abs(z - currentZoom) < 0.01);
                const idx = currentIdx === -1 ? ZOOM_STEPS.indexOf(1.0) : currentIdx;
                const canZoomOut = idx > 0;
                const canZoomIn = idx < ZOOM_STEPS.length - 1;
                return (
                  <>
                    <div className="w-px h-4 bg-slate-200 mx-0.5" />
                    <button
                      data-testid="zoom-out"
                      aria-label="Zoom out"
                      disabled={!canZoomOut}
                      onClick={() => handleUpdate({ assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings: { ...timelineSettings, columnZoom: ZOOM_STEPS[idx - 1] }, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails })}
                      className={cn(toggleClass(false), !canZoomOut && 'opacity-30 cursor-not-allowed')}
                      title="Zoom out"
                    >
                      <ZoomOut size={13} />
                    </button>
                    <button
                      data-testid="zoom-in"
                      aria-label="Zoom in"
                      disabled={!canZoomIn}
                      onClick={() => handleUpdate({ assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings: { ...timelineSettings, columnZoom: ZOOM_STEPS[idx + 1] }, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails })}
                      className={cn(toggleClass(false), !canZoomIn && 'opacity-30 cursor-not-allowed')}
                      title="Zoom in"
                    >
                      <ZoomIn size={13} />
                    </button>
                  </>
                );
              })()}

              {/* More settings (snap, empty rows) */}
              <div className="relative" ref={moreSettingsPanelRef}>
                <button
                  data-testid="display-more-btn"
                  onClick={() => setShowMoreSettingsPanel(v => !v)}
                  className={toggleClass(showMoreSettingsPanel)}
                  title="More settings"
                >
                  <MoreHorizontal size={13} />
                </button>
                {showMoreSettingsPanel && moreSettingsPanelRef.current && (() => {
                  const r = moreSettingsPanelRef.current!.getBoundingClientRect();
                  const w = 192; // w-48
                  const left = Math.min(r.left, window.innerWidth - w - 4);
                  return (
                  <div
                    className="fixed bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-3 w-48"
                    style={{ top: r.bottom + 6, left }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="space-y-2">
                      {[
                        { label: 'Empty Rows', id: 'emptyRowDisplay', value: timelineSettings.emptyRowDisplay || 'show', options: [['show', 'Show'], ['hide', 'Hide']], key: 'emptyRowDisplay' as const },
                        { label: 'Snap to Month', id: 'snapToPeriod', value: timelineSettings.snapToPeriod || 'off', options: [['off', 'Off'], ['month', 'Month']], key: 'snapToPeriod' as const },
                      ].map(({ label, id, value, options, key }) => (
                        <div key={id} className="flex items-center justify-between gap-3">
                          <label htmlFor={id} className="text-xs text-slate-600 whitespace-nowrap">{label}</label>
                          <select
                            id={id}
                            value={value}
                            onChange={(e) => {
                              handleUpdate({
                                assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories,
                                timelineSettings: { ...timelineSettings, [key]: e.target.value },
                                resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails,
                              });
                            }}
                            className="px-1.5 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            {options.map(([val, lbl]) => (
                              <option key={val} value={val}>{lbl}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                      <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100">
                        <label htmlFor="defaultCurrency" className="text-xs text-slate-600 whitespace-nowrap">Currency</label>
                        <input
                          id="defaultCurrency"
                          data-testid="default-currency-input"
                          type="text"
                          value={timelineSettings.defaultCurrency || ''}
                          onChange={(e) => {
                            handleUpdate({
                              assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories,
                              timelineSettings: { ...timelineSettings, defaultCurrency: e.target.value || undefined },
                              resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails,
                            });
                          }}
                          placeholder="e.g. IDR"
                          className="px-1.5 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 w-16"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100">
                        <label htmlFor="clusterName" className="text-xs text-slate-600 whitespace-nowrap">Cluster</label>
                        <input
                          id="clusterName"
                          data-testid="cluster-name-input"
                          type="text"
                          value={timelineSettings.clusterName || ''}
                          onChange={(e) => {
                            handleUpdate({
                              assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories,
                              timelineSettings: { ...timelineSettings, clusterName: e.target.value || undefined },
                              resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails,
                            });
                          }}
                          placeholder="e.g. Digital First Cluster"
                          className="px-1.5 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 w-32"
                        />
                      </div>
                    </div>
                  </div>
                  );
                })()}
              </div>
            </div>
          );
        })()}
        </>}

        {/* View Options — colour-by and group-by in a single compact popover */}
        {view === 'visualiser' && (() => {
          const colorBy = timelineSettings.colorBy || 'programme';
          const groupBy = timelineSettings.groupBy || 'asset';
          const display = timelineSettings.display || 'both';
          const colorLabel = colorBy === 'programme' ? 'Programme' : colorBy === 'strategy' ? 'Strategy' : colorBy === 'rag' ? 'Status' : 'Progress';
          const groupLabel = groupBy === 'asset' ? 'Asset' : groupBy === 'programme' ? 'Programme' : 'Strategy';
          const displayLabel = display === 'initiatives' ? 'Initiatives' : display === 'deliverables' ? 'Deliverables' : 'Both';
          return (
            <div className="relative shrink-0" ref={viewOptionsPanelRef}>
              <button
                data-testid="view-options-btn"
                onClick={() => setShowViewOptionsPanel(v => !v)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                  showViewOptionsPanel
                    ? "bg-blue-50 border-blue-200 text-blue-600"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                )}
                title="View options: colour, grouping and display"
              >
                <Palette size={13} />
                {colorLabel}
                <span className="text-slate-300">·</span>
                <Box size={13} />
                {groupLabel}
                <span className="text-slate-300">·</span>
                {displayLabel}
              </button>

              {showViewOptionsPanel && viewOptionsPanelRef.current && (() => {
                const r = viewOptionsPanelRef.current!.getBoundingClientRect();
                const w = 208; // w-52
                const left = Math.min(r.left, window.innerWidth - w - 4);
                return (
                <div
                  data-testid="view-options-popover"
                  className="fixed bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-3 w-52"
                  style={{ top: r.bottom + 6, left }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {/* Colour by */}
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Colour by</p>
                  <div className="flex flex-col gap-1 mb-3">
                    <button
                      aria-pressed={colorBy === 'programme'}
                      onClick={() => handleUpdateSettings({ ...timelineSettings, colorBy: 'programme' })}
                      className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all", colorBy === 'programme' ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:bg-slate-50")}
                    >
                      <Palette size={13} />
                      By Programme
                    </button>
                    <button
                      aria-pressed={colorBy === 'strategy'}
                      onClick={() => handleUpdateSettings({ ...timelineSettings, colorBy: 'strategy' })}
                      className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all", colorBy === 'strategy' ? "bg-indigo-50 text-indigo-600" : "text-slate-600 hover:bg-slate-50")}
                    >
                      <Palette size={13} />
                      By Strategy
                    </button>
                    <button
                      aria-pressed={colorBy === 'status'}
                      onClick={() => handleUpdateSettings({ ...timelineSettings, colorBy: 'status' })}
                      className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all", colorBy === 'status' ? "bg-emerald-50 text-emerald-600" : "text-slate-600 hover:bg-slate-50")}
                    >
                      <Palette size={13} />
                      By Progress
                    </button>
                    <button
                      aria-pressed={colorBy === 'rag'}
                      onClick={() => handleUpdateSettings({ ...timelineSettings, colorBy: 'rag' })}
                      className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all", colorBy === 'rag' ? "bg-rose-50 text-rose-600" : "text-slate-600 hover:bg-slate-50")}
                    >
                      <Palette size={13} />
                      By Status
                    </button>
                  </div>

                  {/* Group by */}
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Group by</p>
                  <div className="flex flex-col gap-1 mb-3">
                    <button
                      data-testid="group-by-asset"
                      aria-pressed={groupBy === 'asset'}
                      onClick={() => handleUpdateSettings({ ...timelineSettings, groupBy: 'asset' })}
                      className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all", groupBy === 'asset' ? "bg-slate-100 text-slate-800" : "text-slate-600 hover:bg-slate-50")}
                    >
                      <Box size={13} />
                      Asset
                    </button>
                    <button
                      data-testid="group-by-programme"
                      aria-pressed={groupBy === 'programme'}
                      onClick={() => handleUpdateSettings({ ...timelineSettings, groupBy: 'programme' })}
                      className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all", groupBy === 'programme' ? "bg-slate-100 text-slate-800" : "text-slate-600 hover:bg-slate-50")}
                    >
                      <Boxes size={13} />
                      Programme
                    </button>
                    <button
                      data-testid="group-by-strategy"
                      aria-pressed={groupBy === 'strategy'}
                      onClick={() => handleUpdateSettings({ ...timelineSettings, groupBy: 'strategy' })}
                      className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all", groupBy === 'strategy' ? "bg-slate-100 text-slate-800" : "text-slate-600 hover:bg-slate-50")}
                    >
                      <Target size={13} />
                      Strategy
                    </button>
                  </div>

                  {/* Show */}
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Show</p>
                  <div className="flex flex-col gap-1">
                    <button
                      data-testid="show-both"
                      aria-pressed={display === 'both'}
                      onClick={() => handleUpdateSettings({ ...timelineSettings, display: 'both' })}
                      className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all", display === 'both' ? "bg-slate-100 text-slate-800" : "text-slate-600 hover:bg-slate-50")}
                    >
                      <Layers size={13} />
                      Both
                    </button>
                    <button
                      data-testid="show-initiatives"
                      aria-pressed={display === 'initiatives'}
                      onClick={() => handleUpdateSettings({ ...timelineSettings, display: 'initiatives' })}
                      className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all", display === 'initiatives' ? "bg-slate-100 text-slate-800" : "text-slate-600 hover:bg-slate-50")}
                    >
                      <GitCommitHorizontal size={13} />
                      Initiatives
                    </button>
                    <button
                      data-testid="show-deliverables"
                      aria-pressed={display === 'deliverables'}
                      onClick={() => handleUpdateSettings({ ...timelineSettings, display: 'deliverables' })}
                      className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all", display === 'deliverables' ? "bg-slate-100 text-slate-800" : "text-slate-600 hover:bg-slate-50")}
                    >
                      <AppWindow size={13} />
                      Deliverables
                    </button>
                  </div>
                </div>
                );
              })()}
            </div>
          );
        })()}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Data Controls (PDF, Export, Import) */}
        <DataControls
          data={{ assets, deliverables, deliverableSegments, deliverableStatuses, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, versions, decisions, rptiDetails, lkptiDetails }}
          onImport={handleUpdate}
          onPrepareReplacement={prepareOperation}
          onCommitReplacement={commitReplacement}
          persistedRevision={persistedRevision}
          onViewerImport={handleViewerImport}
          onError={setDbSaveError}
          timelineId={view === 'visualiser' ? 'timeline-visualiser' : undefined}
        />

        <div className="w-px h-6 bg-slate-200 shrink-0" />

        {/* Undo/Redo */}
        <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200 p-0.5 shrink-0">
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="p-1.5 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed rounded-md transition-colors"
            title="Undo"
          >
            <Undo2 size={14} />
          </button>
          {undoStack.length > 0 && (
            <span data-testid="undo-counter" className="text-[10px] font-medium text-slate-400 px-0.5 min-w-[12px] text-center leading-none select-none">
              {undoStack.length}
            </span>
          )}
          <div className="w-px h-3.5 bg-slate-200" />
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="p-1.5 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed rounded-md transition-colors"
            title="Redo"
          >
            <Redo2 size={14} />
          </button>
        </div>

        {/* Features / Tutorial */}
        <div className="flex bg-slate-50 rounded-lg border border-slate-200 p-0.5 shrink-0">
          <button
            onClick={() => setShowFeatures(true)}
            data-testid="nav-features"
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-white rounded-md transition-colors"
            title="Features"
          >
            <BookOpen size={16} />
          </button>
          <div className="w-px h-3.5 bg-slate-200 my-auto mx-0.5" />
          <button
            onClick={() => setShowTutorial(true)}
            data-testid="nav-tutorial"
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-white rounded-md transition-colors"
            title="Tutorial"
          >
            <HelpCircle size={16} />
          </button>
          <div className="w-px h-3.5 bg-slate-200 my-auto mx-0.5" />
          <button
            onClick={() => setShowShortcuts(true)}
            data-testid="keyboard-shortcuts-btn"
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-white rounded-md transition-colors"
            title="Keyboard Shortcuts"
          >
            <Keyboard size={16} />
          </button>
        </div>
        </div>{/* end desktop-header-controls */}
      </header>

      {/* ── Mobile settings bottom sheet ── */}
      {showMobileSheet && (
        <>
          <div
            data-testid="mobile-settings-backdrop"
            className="fixed inset-0 bg-slate-900/40 z-40 md:hidden"
            onClick={() => setShowMobileSheet(false)}
            onKeyDown={(e) => e.key === 'Escape' && setShowMobileSheet(false)}
          />
          <div
            data-testid="mobile-settings-sheet"
            className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white rounded-t-2xl shadow-2xl border-t border-slate-200 p-5 space-y-4"
            onKeyDown={(e) => e.key === 'Escape' && setShowMobileSheet(false)}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-slate-700">Settings</span>
              <button onClick={() => setShowMobileSheet(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                <X size={16} />
              </button>
            </div>
            <label className="flex items-center justify-between text-sm text-slate-600">
              Start date
              <input
                type="date"
                value={timelineSettings.startDate}
                onChange={(e) => handleUpdate({ assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings: { ...timelineSettings, startDate: e.target.value }, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails })}
                className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
            <label className="flex items-center justify-between text-sm text-slate-600">
              Months
              <select
                value={timelineSettings.monthsToShow || 36}
                onChange={(e) => handleUpdate({ assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings: { ...timelineSettings, monthsToShow: parseInt(e.target.value) as 3 | 6 | 12 | 24 | 36 }, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails })}
                className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="3">3</option>
                <option value="6">6</option>
                <option value="12">12</option>
                <option value="24">24</option>
                <option value="36">36</option>
              </select>
            </label>
            {/* Group by — bucket mode for card view */}
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Group by</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {(['Timeline', 'Quarter', 'Year', 'Programme', 'Strategy'] as const).map(label => {
                  const mode = label.toLowerCase() as 'timeline' | 'quarter' | 'year' | 'programme' | 'strategy';
                  const active = (timelineSettings.mobileBucketMode ?? 'timeline') === mode;
                  return (
                    <button
                      key={mode}
                      data-testid={`bucket-mode-${mode}`}
                      onClick={() => handleUpdate({ assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings: { ...timelineSettings, mobileBucketMode: mode }, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails })}
                      className={cn(
                        'px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                        active ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500'
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {(() => {
              const conflictsOn = (timelineSettings.conflictDetection || 'on') === 'on';
              const relationshipsOn = (timelineSettings.showRelationships || 'on') === 'on';
              const descriptionsOn = (timelineSettings.descriptionDisplay || 'off') === 'on';
              const budgetMode = timelineSettings.budgetVisualisation || 'off';
              const budgetCycle: Array<'off' | 'label' | 'bar-height'> = ['off', 'label', 'bar-height'];
              const nextBudget = budgetCycle[(budgetCycle.indexOf(budgetMode as 'off' | 'label' | 'bar-height') + 1) % 3];
              const sheetToggleClass = (active: boolean) => cn(
                'px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                active ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500'
              );
              return (
                <div className="flex flex-wrap gap-2">
                  <button data-testid="mobile-toggle-conflicts" aria-pressed={conflictsOn} className={sheetToggleClass(conflictsOn)} onClick={() => handleUpdate({ assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings: { ...timelineSettings, conflictDetection: conflictsOn ? 'off' : 'on' }, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails })}>Conflicts</button>
                  <button data-testid="mobile-toggle-relationships" aria-pressed={relationshipsOn} className={sheetToggleClass(relationshipsOn)} onClick={() => handleUpdate({ assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings: { ...timelineSettings, showRelationships: relationshipsOn ? 'off' : 'on' }, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails })}>Relationships</button>
                  <button data-testid="mobile-toggle-descriptions" aria-pressed={descriptionsOn} className={sheetToggleClass(descriptionsOn)} onClick={() => handleUpdate({ assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings: { ...timelineSettings, descriptionDisplay: descriptionsOn ? 'off' : 'on' }, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails })}>Descriptions</button>
                  <button data-testid="mobile-toggle-budget" aria-pressed={budgetMode !== 'off'} className={sheetToggleClass(budgetMode !== 'off')} onClick={() => handleUpdate({ assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings: { ...timelineSettings, budgetVisualisation: nextBudget }, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails })}>Budget: {budgetMode}</button>
                </div>
              );
            })()}
          </div>
        </>
      )}

      {/* ── Mobile bottom tab bar ── */}
      <div data-testid="mobile-tab-bar" className="flex md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 shadow-lg">
        {([
          { id: 'visualiser', testid: 'mobile-tab-visualiser', icon: <LayoutGrid size={20} />, label: 'Visualiser' },
          { id: 'reports',    testid: 'mobile-tab-reports',    icon: <BarChart2 size={20} />,  label: 'Reports' },
        ] as const).map(tab => (
          <button
            key={tab.id}
            data-testid={tab.testid}
            onClick={() => setView(tab.id)}
            className={cn(
              'flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors border-t-2',
              view === tab.id ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <main className="flex-1 min-h-0 pb-16 md:pb-0">
        {view === 'visualiser' ? (
          isMobile ? (
            <MobileCardView
              assets={assets}
              initiatives={initiatives}
              programmes={programmes}
              strategies={strategies}
              dependencies={dependencies}
              assetCategories={assetCategories}
              settings={timelineSettings}
              resources={resources}
              decisions={decisions}
              onOpenDecision={handleOpenDecision}
              onSaveInitiative={handleUpdateInitiative}
              onDeleteInitiative={handleDeleteInitiative}
              onOpenSettings={() => setShowMobileSheet(true)}
            />
          ) : (
          <Timeline
            assets={assets}
            deliverables={deliverables}
            initiatives={initiatives}
            milestones={milestones}
            programmes={programmes}
            strategies={strategies}
            dependencies={dependencies}
            assetCategories={assetCategories}
            resources={resources}
            settings={timelineSettings}
            searchQuery={searchQuery}
            onAddInitiative={handleAddInitiative}
            onUpdateInitiative={handleUpdateInitiative}
            onUpdateAssets={handleUpdateAssets}
            onUpdateDependencies={handleUpdateDependencies}
            onUpdateMilestone={handleUpdateMilestone}
            onDeleteInitiative={handleDeleteInitiative}
            onUpdateSettings={handleUpdateSettings}
            deliverableSegments={deliverableSegments}
            onSaveDeliverableSegment={handleSaveDeliverableSegment}
            onDeleteDeliverableSegment={handleDeleteDeliverableSegment}
            onUpdateDeliverableSegments={handleUpdateDeliverableSegments}
            deliverableStatuses={deliverableStatuses}
            decisions={decisions}
            onOpenDecision={handleOpenDecision}
            onDeleteAsset={handleDeleteAsset}
            onBulkDeleteAssets={handleBulkDeleteAssets}
            onAddAssets={handleAddAssets}
          />
          )
        ) : view === 'data' ? (
          <Suspense fallback={<LoadingFallback />}>
            <DataManager
              data={{ assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails }}
              onUpdate={handleUpdate}
              onOpenTemplatePicker={() => { setTemplatePickerIsReset(true); setShowTemplatePicker(true); }}
              searchQuery={searchQuery}
              onClearSearch={() => setSearchQuery('')}
              initialTab={dataManagerInitialTab}
            />
          </Suspense>
        ) : view === 'reports' ? (
          <Suspense fallback={<LoadingFallback />}>
            <ReportsView
              initialReport={initialReport}
              assets={assets}
              initiatives={initiatives}
              milestones={milestones}
              dependencies={dependencies}
              currentData={getCurrentState()}
              programmes={programmes}
              strategies={strategies}
              assetCategories={assetCategories}
              resources={resources}
              deliverables={deliverables}
              deliverableSegments={deliverableSegments}
              deliverableStatuses={deliverableStatuses}
              rptiDetails={rptiDetails}
              lkptiDetails={lkptiDetails}
              onSaveAsset={handleUpdateAsset}
              onNavigate={handleNavigateFromHealthIssue}
              onRepairUnresolvedRow={handleRepairUnresolvedRow}
              onExtendImportPriorPhase={handleExtendImportPriorPhase}
            />
          </Suspense>
        ) : view === 'history' ? (
          <Suspense fallback={<LoadingFallback />}>
            <HistoryView
              versions={versions}
              onSaveVersion={handleSaveVersion}
              onDeleteVersion={handleDeleteVersion}
              onRequestRestore={handleRequestRestore}
              decisions={decisions}
              initiatives={initiatives}
              programmes={programmes}
              assets={assets}
              onAddDecision={handleAddDecision}
              onUpdateDecision={handleUpdateDecision}
              onDeleteDecision={handleDeleteDecision}
              selectedDecisionId={selectedDecisionId}
              onSelectDecisionId={setSelectedDecisionId}
              currentData={{
                assets,
                deliverables,
                deliverableSegments,
                initiatives,
                milestones,
                programmes,
                strategies,
                dependencies,
                assetCategories,
                timelineSettings,
                resources,
                deliverableStatuses,
                decisions,
                rptiDetails,
                lkptiDetails,
              }}
            />
          </Suspense>
        ) : (
          <Suspense fallback={<LoadingFallback />}>
            <HelpView />
          </Suspense>
        )}
      </main>

      <footer className="hidden md:flex flex-shrink-0 pt-2 items-center justify-center gap-1 text-xs text-slate-400">
        Selara IT Portfolio Planner — an{' '}
        <a
          href="https://github.com/nofanto/Selara"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-slate-600 transition-colors"
        >
          open source
        </a>
        {' '}tool
      </footer>

      {showFeatures && (
        <ModalErrorBoundary onDismiss={() => setShowFeatures(false)}>
          <TestErrorThrower />
          <Suspense fallback={null}>
            <FeaturesModal onClose={() => setShowFeatures(false)} />
          </Suspense>
        </ModalErrorBoundary>
      )}

      <ModalErrorBoundary onDismiss={() => setShowShortcuts(false)}>
        <Suspense fallback={null}>
          <KeyboardShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
        </Suspense>
      </ModalErrorBoundary>

      {importSummary && (
        <div
          data-testid="import-summary"
          className="fixed bottom-4 right-4 z-[150] max-w-md bg-white border border-slate-200 rounded-xl shadow-lg p-4 text-sm"
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <h4 className="font-bold text-slate-800">Import complete</h4>
            <button
              onClick={() => setImportSummary(null)}
              data-testid="import-summary-dismiss"
              aria-label="Dismiss import summary"
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          </div>
          <p className="text-slate-600">
            LKPTI {importSummary.lkptiYear}: {importSummary.lkptiRows} row(s)
            {importSummary.rptiYear ? ` \u00b7 RPTI ${importSummary.rptiYear}: ${importSummary.rptiRows} row(s)` : ' \u00b7 no RPTI supplied'}
          </p>
          {/* Stated even when zero: silence and success must not look identical. */}
          <p className="text-slate-500 mt-1">
            {importSummary.skipped.length === 0
              ? 'No rows were skipped.'
              : `${importSummary.skipped.length} row(s) skipped \u2014 e.g. row ${importSummary.skipped[0].rowNumber}: ${importSummary.skipped[0].reason}`}
          </p>
          {importSummary.unresolved > 0 && (
            <p className="text-amber-700 mt-1">
              {importSummary.unresolved} planned upgrade(s) reference an application not in your
              inventory. They are listed in the data-health review.
            </p>
          )}
        </div>
      )}

      {showTemplatePicker && !showLandingPage && (
        <ModalErrorBoundary onDismiss={() => { setShowTemplatePicker(false); setTemplatePickerIsReset(false); }}>
          <Suspense fallback={null}>
            <TemplatePickerModal
              onSelect={handleSelectTemplate}
              onImportReturns={handleImportReturns}
              onRestoreBackup={handleRestoreBackupFile}
              backup={versions.length > 0 || decisions.length > 0
                ? { onPrepareBackup: handlePrepareBackup, versions: versions.length, decisions: decisions.length }
                : undefined}
              isReset={templatePickerIsReset}
              onClose={() => { setShowTemplatePicker(false); setTemplatePickerIsReset(false); }}
              inert={!!openReplacement}
            />
          </Suspense>
        </ModalErrorBoundary>
      )}

      {/* After the template picker, so a preview opened from it sits on top. */}
      {openReplacement && (() => {
        const { current } = openReplacement.prepared;
        const next = openReplacement.next(current);
        const stale = openReplacement.prepared.revision !== persistedRevision;
        return (
          <ConfirmModal
            isOpen
            wide
            closeOnEscape
            title={openReplacement.title}
            message={openReplacement.message}
            confirmLabel={openReplacement.confirmLabel}
            busy={openReplacement.saving}
            confirmDisabled={stale || openReplacement.refreshing}
            onCancel={cancelReplacement}
            onConfirm={confirmReplacement}
          >
            <ReplacementSummary
              rows={summariseReplacement(current, { ...next, versions: next.versions ?? current.versions }).rows}
              effects={describeReplacementEffects(current, next)}
              notices={openReplacement.notices}
              stale={stale}
              onRefresh={refreshReplacement}
              refreshing={openReplacement.refreshing}
              error={openReplacement.error}
            />
          </ConfirmModal>
        );
      })()}

      {(busyMessage || isImportingShare) && (
        <div
          data-testid={isImportingShare ? 'restoring-data-modal' : 'operation-busy'}
          aria-busy="true"
          aria-live="polite"
          className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/20"
        >
          <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm text-slate-700 shadow-lg">
            <Loader2 className="animate-spin" size={16} />
            {isImportingShare ? 'Decrypting and loading the shared workspace…' : busyMessage}
          </div>
        </div>
      )}

      {showTutorial && (
        <ModalErrorBoundary onDismiss={() => setShowTutorial(false)}>
          <Suspense fallback={null}>
            <TutorialModal
              onClose={() => {
                setShowTutorial(false);
                if (!timelineSettings.hasSeenTutorial) {
                  handleUpdate({
                    assets, deliverables, deliverableSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories,
                    timelineSettings: { ...timelineSettings, hasSeenTutorial: true },
                    resources, deliverableStatuses, decisions, rptiDetails, lkptiDetails,
                  });
                }
              }} 
            />
          </Suspense>
        </ModalErrorBoundary>
      )}

      {showLandingPage && (
        <ModalErrorBoundary onDismiss={() => setShowLandingPage(false)}>
          <Suspense fallback={null}>
            <LandingPage
              onGetStarted={() => {
                setShowLandingPage(false);
                localStorage.setItem('scenia_has_seen_landing', 'true');
              }}
            />
          </Suspense>
        </ModalErrorBoundary>
      )}

    </div>
  );
}
