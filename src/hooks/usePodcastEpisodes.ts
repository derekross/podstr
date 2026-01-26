import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import type { PodcastEpisode, EpisodeSearchOptions, EpisodeValue } from '@/types/podcast';
import { getCreatorPubkeyHex, PODCAST_KINDS } from '@/lib/podcastConfig';
import { extractZapAmount, validateZapEvent } from '@/lib/zapUtils';

/** Extended options for episode fetching with performance controls */
interface ExtendedEpisodeSearchOptions extends EpisodeSearchOptions {
  /** Skip fetching zap data for better performance (default: false) */
  skipZaps?: boolean;
  /** Cursor for pagination - fetch episodes before this timestamp */
  until?: number;
}

/**
 * Validates if a Nostr event is a valid podcast episode (NIP-54)
 */
function validatePodcastEpisode(event: NostrEvent): boolean {
  if (event.kind !== PODCAST_KINDS.EPISODE) return false;

  // Check for required title tag (NIP-54)
  const title = event.tags.find(([name]) => name === 'title')?.[1];
  if (!title) return false;

  // Check for required audio tag (NIP-54)
  const audio = event.tags.find(([name]) => name === 'audio')?.[1];
  if (!audio) return false;

  // Verify it's from the podcast creator
  if (event.pubkey !== getCreatorPubkeyHex()) return false;

  return true;
}

/**
 * Checks if an event is an edit of another event
 */
function isEditEvent(event: NostrEvent): boolean {
  return event.tags.some(([name]) => name === 'edit');
}

/**
 * Gets the original event ID from an edit event
 */
function getOriginalEventId(event: NostrEvent): string | undefined {
  return event.tags.find(([name]) => name === 'edit')?.[1];
}

/**
 * Converts a validated Nostr event to a PodcastEpisode object
 */
function eventToPodcastEpisode(event: NostrEvent): PodcastEpisode {
  const tags = new Map(event.tags.map(([key, ...values]) => [key, values]));

  const title = tags.get('title')?.[0] || 'Untitled Episode';
  const description = tags.get('description')?.[0];
  const imageUrl = tags.get('image')?.[0];

  // Extract audio URL and type from audio tag (NIP-54 format)
  const audioTag = tags.get('audio');
  const audioUrl = audioTag?.[0] || '';
  const audioType = audioTag?.[1] || 'audio/mpeg';

  // Extract video URL and type from video tag
  const videoTag = tags.get('video');
  const videoUrl = videoTag?.[0];
  const videoType = videoTag?.[1];

  // Extract all 't' tags for topics
  const topicTags = event.tags
    .filter(([name]) => name === 't')
    .map(([, value]) => value);

  // Extract identifier from 'd' tag (for addressable events)
  const identifier = tags.get('d')?.[0] || event.id; // Fallback to event ID for backward compatibility

  // Extract duration from tag
  const durationStr = tags.get('duration')?.[0];
  const duration = durationStr ? parseInt(durationStr, 10) : undefined;

  // Extract publication date from pubdate tag with fallback to created_at
  const pubdateStr = tags.get('pubdate')?.[0];
  let publishDate: Date;
  try {
    publishDate = pubdateStr ? new Date(pubdateStr) : new Date(event.created_at * 1000);
  } catch {
    publishDate = new Date(event.created_at * 1000);
  }

  // Extract transcript URL from tag
  const transcriptUrl = tags.get('transcript')?.[0];

  // Extract chapters URL from tag
  const chaptersUrl = tags.get('chapters')?.[0];

  // Extract episode number from tag
  const episodeNumStr = tags.get('episode')?.[0];
  const episodeNumber = episodeNumStr ? parseInt(episodeNumStr, 10) : undefined;

  // Extract season number from tag
  const seasonNumStr = tags.get('season')?.[0];
  const seasonNumber = seasonNumStr ? parseInt(seasonNumStr, 10) : undefined;

  // Extract per-episode value splits from tag
  let value: EpisodeValue | undefined;
  const valueStr = tags.get('value')?.[0];
  if (valueStr) {
    try {
      value = JSON.parse(valueStr) as EpisodeValue;
    } catch {
      console.warn('Failed to parse episode value tag:', valueStr);
    }
  }

  // Content is just the show notes (plain text)
  const content = event.content || undefined;

  return {
    id: event.id,
    title,
    description,
    content,
    audioUrl,
    audioType,
    videoUrl,
    videoType,
    imageUrl,
    duration,
    episodeNumber,
    seasonNumber,
    publishDate,
    explicit: false, // Can be extended later if needed
    tags: topicTags,
    transcriptUrl,
    chaptersUrl,
    externalRefs: [],
    value,
    eventId: event.id,
    authorPubkey: event.pubkey,
    identifier,
    createdAt: new Date(event.created_at * 1000),
  };
}

/**
 * Hook to fetch all podcast episodes from the creator
 */
export function usePodcastEpisodes(options: ExtendedEpisodeSearchOptions = {}) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['podcast-episodes', options],
    queryFn: async (context) => {
      const signal = AbortSignal.any([context.signal, AbortSignal.timeout(10000)]);

      // Build query filter with optional cursor-based pagination
      const events = await nostr.query([{
        kinds: [PODCAST_KINDS.EPISODE],
        authors: [getCreatorPubkeyHex()],
        limit: options.limit || 20, // Reduced default from 100 to 20 for better performance
        ...(options.until ? { until: options.until } : {}),
      }], { signal });

      // Filter and validate events
      const validEvents = events.filter(validatePodcastEpisode);

      // Deduplicate episodes by title - keep only the latest version of each title
      const episodesByTitle = new Map<string, NostrEvent>();
      const originalEvents = new Set<string>(); // Track original events that have been edited

      // First pass: identify edited events and their originals
      validEvents.forEach(event => {
        if (isEditEvent(event)) {
          const originalId = getOriginalEventId(event);
          if (originalId) {
            originalEvents.add(originalId);
          }
        }
      });

      // Second pass: select the best version for each title
      validEvents.forEach(event => {
        const title = event.tags.find(([name]) => name === 'title')?.[1] || '';
        if (!title) return;

        // Skip if this is an original event that has been edited
        if (originalEvents.has(event.id)) return;

        const existing = episodesByTitle.get(title);
        if (!existing) {
          episodesByTitle.set(title, event);
        } else {
          // Keep the event with the latest created_at (most recent edit)
          // This ensures we get the latest content while preserving pubdate for sorting
          if (event.created_at > existing.created_at) {
            episodesByTitle.set(title, event);
          }
        }
      });

      // Convert to podcast episodes
      const validEpisodes = Array.from(episodesByTitle.values()).map(eventToPodcastEpisode);

      // Fetch zap data for all episodes in a single query (optional for performance)
      const episodeIds = validEpisodes.map(ep => ep.eventId);

      const zapData: Map<string, { count: number; totalSats: number }> = new Map();

      // Only fetch zaps if not explicitly skipped (for performance)
      if (!options.skipZaps && episodeIds.length > 0) {
        try {
          // Query for all zaps to these episodes
          const zapEvents = await nostr.query([{
            kinds: [9735], // Zap receipts
            '#e': episodeIds, // Episodes being zapped
            limit: 500 // Reduced from 2000 - fetch more incrementally if needed
          }], { signal });

          // Process zap events and group by episode
          const validZaps = zapEvents.filter(validateZapEvent);

          validZaps.forEach(zapEvent => {
            const episodeId = zapEvent.tags.find(([name]) => name === 'e')?.[1];
            if (!episodeId) return;

            const amount = extractZapAmount(zapEvent);
            const existing = zapData.get(episodeId) || { count: 0, totalSats: 0 };

            zapData.set(episodeId, {
              count: existing.count + 1,
              totalSats: existing.totalSats + amount
            });
          });
        } catch (error) {
          console.warn('Failed to fetch zap data for episodes:', error);
          // Continue without zap data rather than failing completely
        }
      }

      // Add zap counts to episodes
      const episodesWithZaps = validEpisodes.map(episode => {
        const zaps = zapData.get(episode.eventId);
        return {
          ...episode,
          ...(zaps && zaps.count > 0 ? { zapCount: zaps.count } : {}),
          ...(zaps && zaps.totalSats > 0 ? { totalSats: zaps.totalSats } : {})
        };
      });


      // Apply search filtering
      let filteredEpisodes = episodesWithZaps;

      if (options.query) {
        const query = options.query.toLowerCase();
        filteredEpisodes = filteredEpisodes.filter(episode =>
          episode.title.toLowerCase().includes(query) ||
          episode.description?.toLowerCase().includes(query) ||
          episode.content?.toLowerCase().includes(query)
        );
      }

      if (options.tags && options.tags.length > 0) {
        filteredEpisodes = filteredEpisodes.filter(episode =>
          options.tags!.some(tag => episode.tags.includes(tag))
        );
      }

      // Apply sorting
      const sortBy = options.sortBy || 'date';
      const sortOrder = options.sortOrder || 'desc';

      filteredEpisodes.sort((a, b) => {
        let comparison = 0;

        switch (sortBy) {
          case 'date':
            comparison = a.publishDate.getTime() - b.publishDate.getTime();
            break;
          case 'title':
            comparison = a.title.localeCompare(b.title);
            break;
          case 'zaps':
            comparison = (a.zapCount || 0) - (b.zapCount || 0);
            break;
          case 'comments':
            comparison = (a.commentCount || 0) - (b.commentCount || 0);
            break;
        }

        return sortOrder === 'desc' ? -comparison : comparison;
      });

      // Apply offset
      if (options.offset) {
        filteredEpisodes = filteredEpisodes.slice(options.offset);
      }

      return filteredEpisodes;
    },
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook to fetch a single podcast episode by ID
 */
export function usePodcastEpisode(episodeId: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['podcast-episode', episodeId],
    queryFn: async (context) => {
      const signal = AbortSignal.any([context.signal, AbortSignal.timeout(5000)]);

      const events = await nostr.query([{
        ids: [episodeId]
      }], { signal });

      const event = events[0];
      if (!event || !validatePodcastEpisode(event)) {
        return null;
      }

      return eventToPodcastEpisode(event);
    },
    enabled: !!episodeId,
    staleTime: 300000, // 5 minutes
  });
}

/**
 * Hook to get the latest episode
 * Optimized to fetch only the most recent episode for better performance
 */
export function useLatestEpisode() {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['podcast-episode-latest'],
    queryFn: async (context) => {
      const signal = AbortSignal.any([context.signal, AbortSignal.timeout(5000)]);

      // Fetch only a small batch - Nostr returns newest first by default
      const events = await nostr.query([{
        kinds: [PODCAST_KINDS.EPISODE],
        authors: [getCreatorPubkeyHex()],
        limit: 5, // Fetch a few to account for possible duplicates/edits
      }], { signal });

      // Filter and validate events
      const validEvents = events.filter(validatePodcastEpisode);
      if (validEvents.length === 0) return null;

      // Handle deduplication for the small set
      const originalEvents = new Set<string>();
      validEvents.forEach(event => {
        if (isEditEvent(event)) {
          const originalId = getOriginalEventId(event);
          if (originalId) originalEvents.add(originalId);
        }
      });

      // Find the latest valid episode (by pubdate, not created_at)
      let latestEvent: NostrEvent | null = null;
      let latestPubdate = 0;

      for (const event of validEvents) {
        if (originalEvents.has(event.id)) continue; // Skip edited originals

        const pubdateStr = event.tags.find(([name]) => name === 'pubdate')?.[1];
        const pubdate = pubdateStr 
          ? new Date(pubdateStr).getTime() 
          : event.created_at * 1000;

        if (!latestEvent || pubdate > latestPubdate) {
          latestEvent = event;
          latestPubdate = pubdate;
        }
      }

      return latestEvent ? eventToPodcastEpisode(latestEvent) : null;
    },
    staleTime: 60000, // 1 minute
  });
}

/** Page size for infinite scroll */
const EPISODES_PER_PAGE = 10;

/**
 * Hook for infinite scroll episode loading
 * Returns episodes in pages with cursor-based pagination
 */
export function useInfiniteEpisodes(options: Omit<ExtendedEpisodeSearchOptions, 'until' | 'offset'> = {}) {
  const { nostr } = useNostr();

  return useInfiniteQuery({
    queryKey: ['podcast-episodes-infinite', options],
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam, signal: querySignal }) => {
      const signal = AbortSignal.any([querySignal, AbortSignal.timeout(8000)]);
      const limit = options.limit || EPISODES_PER_PAGE;

      // Fetch episodes with cursor
      const events = await nostr.query([{
        kinds: [PODCAST_KINDS.EPISODE],
        authors: [getCreatorPubkeyHex()],
        limit: limit + 5, // Fetch a few extra to account for duplicates
        ...(pageParam ? { until: pageParam } : {}),
      }], { signal });

      // Filter and validate events
      const validEvents = events.filter(validatePodcastEpisode);

      // Deduplicate episodes by identifier (d tag)
      const episodesByIdentifier = new Map<string, NostrEvent>();
      const originalEvents = new Set<string>();

      // First pass: identify edited events and their originals
      validEvents.forEach(event => {
        if (isEditEvent(event)) {
          const originalId = getOriginalEventId(event);
          if (originalId) originalEvents.add(originalId);
        }
      });

      // Second pass: select the best version for each identifier
      validEvents.forEach(event => {
        if (originalEvents.has(event.id)) return;

        const identifier = event.tags.find(([name]) => name === 'd')?.[1] || event.id;
        const existing = episodesByIdentifier.get(identifier);

        if (!existing || event.created_at > existing.created_at) {
          episodesByIdentifier.set(identifier, event);
        }
      });

      // Convert to podcast episodes
      const episodes = Array.from(episodesByIdentifier.values())
        .map(eventToPodcastEpisode);

      // Sort by publishDate descending
      episodes.sort((a, b) => b.publishDate.getTime() - a.publishDate.getTime());

      // Trim to requested limit
      const trimmedEpisodes = episodes.slice(0, limit);

      // Apply search filtering if specified
      let filteredEpisodes = trimmedEpisodes;

      if (options.query) {
        const query = options.query.toLowerCase();
        filteredEpisodes = filteredEpisodes.filter(episode =>
          episode.title.toLowerCase().includes(query) ||
          episode.description?.toLowerCase().includes(query) ||
          episode.content?.toLowerCase().includes(query)
        );
      }

      if (options.tags && options.tags.length > 0) {
        filteredEpisodes = filteredEpisodes.filter(episode =>
          options.tags!.some(tag => episode.tags.includes(tag))
        );
      }

      // Fetch zap data if not skipped
      if (!options.skipZaps && filteredEpisodes.length > 0) {
        const episodeIds = filteredEpisodes.map(ep => ep.eventId);
        try {
          const zapEvents = await nostr.query([{
            kinds: [9735],
            '#e': episodeIds,
            limit: 200
          }], { signal });

          const validZaps = zapEvents.filter(validateZapEvent);
          const zapData = new Map<string, { count: number; totalSats: number }>();

          validZaps.forEach(zapEvent => {
            const episodeId = zapEvent.tags.find(([name]) => name === 'e')?.[1];
            if (!episodeId) return;

            const amount = extractZapAmount(zapEvent);
            const existing = zapData.get(episodeId) || { count: 0, totalSats: 0 };
            zapData.set(episodeId, {
              count: existing.count + 1,
              totalSats: existing.totalSats + amount
            });
          });

          filteredEpisodes = filteredEpisodes.map(episode => ({
            ...episode,
            ...(zapData.get(episode.eventId) || {})
          }));
        } catch (error) {
          console.warn('Failed to fetch zap data:', error);
        }
      }

      // Determine cursor for next page
      // Use the oldest episode's created_at timestamp minus 1 to avoid duplicates
      const oldestEvent = events.length > 0 
        ? events.reduce((oldest, e) => e.created_at < oldest.created_at ? e : oldest)
        : null;
      const nextCursor = oldestEvent && events.length >= limit 
        ? oldestEvent.created_at - 1 
        : undefined;

      return {
        episodes: filteredEpisodes,
        nextCursor,
        hasMore: !!nextCursor && filteredEpisodes.length >= limit,
      };
    },
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
    staleTime: 60000,
  });
}

/**
 * Hook to get podcast statistics
 */
export function usePodcastStats() {
  const { data: episodes } = usePodcastEpisodes();

  return useQuery({
    queryKey: ['podcast-stats', episodes?.length],
    queryFn: async () => {
      if (!episodes) return null;

      const totalEpisodes = episodes.length;
      const totalZaps = episodes.reduce((sum, ep) => sum + (ep.zapCount || 0), 0);
      const totalComments = episodes.reduce((sum, ep) => sum + (ep.commentCount || 0), 0);
      const totalReposts = episodes.reduce((sum, ep) => sum + (ep.repostCount || 0), 0);

      const mostZappedEpisode = episodes.reduce((max, ep) =>
        (ep.zapCount || 0) > (max?.zapCount || 0) ? ep : max, episodes[0]
      );

      const mostCommentedEpisode = episodes.reduce((max, ep) =>
        (ep.commentCount || 0) > (max?.commentCount || 0) ? ep : max, episodes[0]
      );

      return {
        totalEpisodes,
        totalZaps,
        totalComments,
        totalReposts,
        mostZappedEpisode: mostZappedEpisode?.zapCount ? mostZappedEpisode : undefined,
        mostCommentedEpisode: mostCommentedEpisode?.commentCount ? mostCommentedEpisode : undefined,
        recentEngagement: [] // TODO: Implement recent engagement tracking
      };
    },
    enabled: !!episodes,
    staleTime: 300000, // 5 minutes
  });
}