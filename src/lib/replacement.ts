import type { PersistedWorkspace } from './db';
import type { TimelineSettings } from '../types';

/** A stored workspace with its settings as the screen presents them. */
export type WorkspaceState = Omit<PersistedWorkspace, 'timelineSettings'> & { timelineSettings: TimelineSettings };

/**
 * The base a replacement is reviewed against (FR-015): the stored workspace
 * after every pending save finished, its fingerprint — compared again inside
 * the replacing transaction — and the local revision it was read at, so any
 * later local or remote change makes the preview stale.
 */
export interface PreparedReplacement {
  /** Exactly as stored — what a backup serialises and the fingerprint is taken of. */
  stored: PersistedWorkspace;
  current: WorkspaceState;
  fingerprint: string;
  revision: number;
}

/** `stale`: the stored workspace changed under the preview, so it must be refreshed before retrying. */
export interface ReplaceOutcome { ok: boolean; stale: boolean; message: string }
