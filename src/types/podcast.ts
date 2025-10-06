import type { NostrEvent } from '@nostrify/nostrify';

/**
 * Podcast episode metadata based on NIP-54
 */
export interface PodcastEpisode {
  id: string;
  title: string;
  description?: string;
  content?: string;
  audioUrl: string;
  audioType?: string;
  videoUrl?: string;
  videoType?: string;
  imageUrl?: string;
  duration?: number; // in seconds
  episodeNumber?: number;
  seasonNumber?: number;
  publishDate: Date;
  explicit?: boolean;
  tags: string[];
  // Transcript and chapters as URL references
  transcriptUrl?: string;
  chaptersUrl?: string;
  guests?: PodcastGuest[];
  externalRefs?: ExternalReference[];

  // Nostr-specific fields
  eventId: string;
  authorPubkey: string;
  identifier: string; // 'd' tag identifier for addressable events
  createdAt: Date;
  zapCount?: number;
  totalSats?: number;
  commentCount?: number;
  repostCount?: number;
}

/**
 * Podcast chapter information (Podcasting 2.0)
 */
export interface PodcastChapter {
  startTime: number; // seconds
  title: string;
  img?: string;
  url?: string;
}

/**
 * Podcast guest/person information
 */
export interface PodcastGuest {
  name: string;
  role?: string;
  group?: string;
  img?: string;
  href?: string;
  npub?: string; // Nostr pubkey if available
}

/**
 * External reference for RSS/podcast platform integration (NIP-73)
 */
export interface ExternalReference {
  type: 'podcast:guid' | 'podcast:item:guid' | 'podcast:publisher:guid' | 'apple:id' | 'spotify:id';
  value: string;
  url?: string;
}

/**
 * Podcast episode form data for publishing
 */
export interface EpisodeFormData {
  title: string;
  description: string;
  content?: string;
  audioFile?: File;
  audioUrl?: string;
  audioType?: string;
  videoFile?: File;
  videoUrl?: string;
  videoType?: string;
  imageFile?: File;
  imageUrl?: string;
  transcriptFile?: File;
  transcriptUrl?: string;
  transcriptType?: string;
  chaptersFile?: File;
  chaptersUrl?: string;
  duration?: number;
  episodeNumber?: number;
  seasonNumber?: number;
  explicit?: boolean;
  tags: string[];
  externalRefs?: ExternalReference[];
}

/**
 * Podcast statistics for dashboard/analytics
 */
export interface PodcastStats {
  totalEpisodes: number;
  totalZaps: number;
  totalComments: number;
  totalReposts: number;
  mostZappedEpisode?: PodcastEpisode;
  mostCommentedEpisode?: PodcastEpisode;
  recentEngagement: EngagementActivity[];
}

/**
 * User engagement activity
 */
export interface EngagementActivity {
  type: 'zap' | 'comment' | 'repost';
  episodeId: string;
  episodeTitle: string;
  userPubkey: string;
  amount?: number; // for zaps
  timestamp: Date;
}

/**
 * Zap leaderboard entry
 */
export interface ZapLeaderboardEntry {
  userPubkey: string;
  userName?: string;
  userImage?: string;
  totalAmount: number;
  zapCount: number;
  lastZapDate: Date;
}

/**
 * RSS feed item for XML generation
 */
export interface RSSItem {
  title: string;
  description: string;
  link: string;
  guid: string;
  pubDate: string;
  author: string;
  category?: string[];
  enclosure: {
    url: string;
    length: number;
    type: string;
  };
  videoEnclosure?: {
    url: string;
    length: number;
    type: string;
  };
  duration?: string; // HH:MM:SS format
  episodeNumber?: number;
  seasonNumber?: number;
  explicit?: boolean;
  image?: string;
  // Transcript and chapters as URL references
  transcriptUrl?: string;
  chaptersUrl?: string;
  funding?: Array<{
    url: string;
    message: string;
  }>;
}

/**
 * Utility type for Nostr event validation
 */
export interface ValidatedPodcastEvent extends NostrEvent {
  kind: 30023; // NIP-23 long-form content for podcast episodes
  tags: Array<[string, ...string[]]>;
}

/**
 * Search and filter options for episodes
 */
export interface EpisodeSearchOptions {
  query?: string;
  tags?: string[];
  sortBy?: 'date' | 'zaps' | 'comments' | 'title';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * Audio player state
 */
export interface AudioPlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  currentEpisode?: PodcastEpisode;
  playlist: PodcastEpisode[];
  currentIndex: number;
}

/**
 * Comment with Nostr event data
 */
export interface PodcastComment {
  id: string;
  content: string;
  authorPubkey: string;
  authorName?: string;
  authorImage?: string;
  episodeId: string;
  parentCommentId?: string;
  createdAt: Date;
  zapCount?: number;
  replies: PodcastComment[];
  event: NostrEvent;
}

/**
 * Podcast trailer information (Podcasting 2.0)
 * Based on https://podcasting2.org/docs/podcast-namespace/tags/trailer
 */
export interface PodcastTrailer {
  id: string;
  title: string; // Node value (max 128 chars)
  url: string; // Audio/video file URL
  pubDate: Date; // RFC2822 format
  length?: number; // File size in bytes
  type?: string; // MIME type
  season?: number; // Optional season number
  
  // Nostr-specific fields
  eventId: string;
  authorPubkey: string;
  identifier: string; // 'd' tag identifier
  createdAt: Date;
}

/**
 * Trailer form data for publishing
 */
export interface TrailerFormData {
  title: string;
  url?: string;
  audioFile?: File;
  audioType?: string;
  length?: number;
  season?: number;
}