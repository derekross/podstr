import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import type { PodcastEpisode, EpisodeSearchOptions } from '@/types/podcast';
import { getCreatorPubkeyHex, PODCAST_KINDS } from '@/lib/podcastConfig';
import { extractZapAmount, validateZapEvent } from '@/lib/zapUtils';

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
    episodeNumber: undefined, // Can be extended later if needed
    seasonNumber: undefined, // Can be extended later if needed
    publishDate,
    explicit: false, // Can be extended later if needed
    tags: topicTags,
    transcriptUrl,
    chaptersUrl,
    externalRefs: [],
    eventId: event.id,
    authorPubkey: event.pubkey,
    identifier,
    createdAt: new Date(event.created_at * 1000),
  };
}

/**
 * Hook to fetch all podcast episodes from the creator
 */
export function usePodcastEpisodes(options: EpisodeSearchOptions = {}) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['podcast-episodes', options],
    queryFn: async (context) => {
      const signal = AbortSignal.any([context.signal, AbortSignal.timeout(10000)]);

      const events = await nostr.query([{
        kinds: [PODCAST_KINDS.EPISODE],
        authors: [getCreatorPubkeyHex()],
        limit: options.limit || 100
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

      // Fetch zap data for all episodes in a single query
      const episodeIds = validEpisodes.map(ep => ep.eventId);

      const zapData: Map<string, { count: number; totalSats: number }> = new Map();

      if (episodeIds.length > 0) {
        try {
          // Query for all zaps to these episodes
          const zapEvents = await nostr.query([{
            kinds: [9735], // Zap receipts
            '#e': episodeIds, // Episodes being zapped
            limit: 2000 // High limit to get all zaps
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
 * Uses the same query as the Recent Episodes section to ensure cache consistency
 */
export function useLatestEpisode() {
  const { data: episodes, ...rest } = usePodcastEpisodes({
    limit: 50, // Use a reasonable default that covers most use cases
    sortBy: 'date',
    sortOrder: 'desc'
  });

  return {
    data: episodes?.[0] || null,
    ...rest
  };
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