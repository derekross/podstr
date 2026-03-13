/**
 * TypeScript types for livestream-to-episode conversion system
 */

import type { NostrEvent } from '@nostrify/nostrify';

/**
 * Configuration for the livestream conversion process
 */
export interface LivestreamConversionConfig {
  batchMode: boolean;
  livestreamIds?: string;
  nostrPrivateKey: string;
  nbunksec?: string;
  targetNpub: string;
}

/**
 * State persisted across workflow runs
 */
export interface ConversionState {
  lastProcessedTimestamp: number;
  processedLivestreams: Record<string, ConversionLivestreamInfo>;
}

/**
 * Information about a processed livestream
 */
export interface ConversionLivestreamInfo {
  address: string;
  timestamp: number;
  episodeId?: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
}

/**
 * Result of a single livestream conversion attempt
 */
export interface LivestreamConversionSummary {
  livestreamAddress: string;
  title: string;
  episodeId?: string;
  status: 'success' | 'failed' | 'skipped';
  reason?: string;
}

/**
 * Overall conversion result
 */
export interface ConversionResult {
  totalLivestreams: number;
  converted: number;
  skipped: number;
  failed: number;
  livestreams: LivestreamConversionSummary[];
}

/**
 * Group of livestreams to be converted together
 */
export interface LivestreamGroup {
  hourKey: string;
  livestreams: NostrEvent[];
}
