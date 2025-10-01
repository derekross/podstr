import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useUploadFile } from '@/hooks/useUploadFile';
import type { EpisodeFormData } from '@/types/podcast';
import { PODCAST_KINDS, isPodcastCreator } from '@/lib/podcastConfig';

/**
 * Hook for publishing podcast episodes (creator only)
 */
export function usePublishEpisode() {
  const { user } = useCurrentUser();
  const { mutateAsync: createEvent } = useNostrPublish();
  const { mutateAsync: uploadFile } = useUploadFile();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (episodeData: EpisodeFormData): Promise<string> => {
      // Verify user is logged in and is the creator
      if (!user) {
        throw new Error('You must be logged in to publish episodes');
      }

      if (!isPodcastCreator(user.pubkey)) {
        throw new Error('Only the podcast creator can publish episodes');
      }

      // Upload audio file if provided
      let audioUrl = episodeData.audioUrl;
      let audioType = episodeData.audioType;

      if (episodeData.audioFile) {
        try {
          const audioTags = await uploadFile(episodeData.audioFile);
          audioUrl = audioTags[0][1]; // First tag contains the URL
          audioType = episodeData.audioFile.type;
        } catch (error) {
          throw new Error(`Failed to upload audio file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      if (!audioUrl) {
        throw new Error('Audio URL or file is required');
      }

      // If we have a URL but no type, try to infer from file extension
      if (audioUrl && !audioType) {
        try {
          const url = new URL(audioUrl);
          const pathname = url.pathname.toLowerCase();
          if (pathname.endsWith('.mp3')) {
            audioType = 'audio/mpeg';
          } else if (pathname.endsWith('.wav')) {
            audioType = 'audio/wav';
          } else if (pathname.endsWith('.m4a')) {
            audioType = 'audio/mp4';
          } else if (pathname.endsWith('.ogg')) {
            audioType = 'audio/ogg';
          } else {
            audioType = 'audio/mpeg'; // Default fallback
          }
        } catch {
          audioType = 'audio/mpeg';
        }
      }

      // Upload image file if provided
      let imageUrl = episodeData.imageUrl;
      if (episodeData.imageFile) {
        try {
          const imageTags = await uploadFile(episodeData.imageFile);
          imageUrl = imageTags[0][1]; // First tag contains the URL
        } catch (error) {
          throw new Error(`Failed to upload image file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Upload video file if provided
      let videoUrl = episodeData.videoUrl;
      let videoType = episodeData.videoType;
      if (episodeData.videoFile) {
        try {
          const videoTags = await uploadFile(episodeData.videoFile);
          videoUrl = videoTags[0][1];
          videoType = episodeData.videoFile.type;
        } catch (error) {
          throw new Error(`Failed to upload video file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Upload transcript file if provided
      let transcriptUrl = episodeData.transcriptUrl;
      const transcriptType = episodeData.transcriptType;
      if (episodeData.transcriptFile) {
        try {
          const transcriptTags = await uploadFile(episodeData.transcriptFile);
          transcriptUrl = transcriptTags[0][1];
        } catch (error) {
          throw new Error(`Failed to upload transcript file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Upload chapters file if provided
      let chaptersUrl = episodeData.chaptersUrl;
      if (episodeData.chaptersFile) {
        try {
          const chaptersTags = await uploadFile(episodeData.chaptersFile);
          chaptersUrl = chaptersTags[0][1];
        } catch (error) {
          throw new Error(`Failed to upload chapters file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Generate a unique identifier for this addressable episode
      const episodeIdentifier = `episode-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Build tags for addressable podcast episode (kind 30054)
      const tags: Array<[string, ...string[]]> = [
        ['d', episodeIdentifier], // Addressable event identifier
        ['title', episodeData.title], // Episode title
        ['audio', audioUrl, audioType || 'audio/mpeg'], // Audio URL with media type
        ['pubdate', new Date().toUTCString()], // RFC2822 format - set once when first published
        ['alt', `Podcast episode: ${episodeData.title}`] // NIP-31 alt tag
      ];

      // Add optional tags per NIP-54
      if (episodeData.description) {
        tags.push(['description', episodeData.description]);
      }

      if (imageUrl) {
        tags.push(['image', imageUrl]);
      }

      // Add video enclosure if provided
      if (videoUrl) {
        tags.push(['video', videoUrl, videoType || 'video/mp4']);
      }

      // Add transcript if provided (Podcasting 2.0)
      if (transcriptUrl) {
        tags.push(['transcript', transcriptUrl, transcriptType || 'text/plain']);
      }

      // Add chapters if provided (Podcasting 2.0)
      if (chaptersUrl) {
        tags.push(['chapters', chaptersUrl, 'application/json+chapters']);
      }

      // Add duration if provided
      if (episodeData.duration && episodeData.duration > 0) {
        tags.push(['duration', episodeData.duration.toString()]);
      }

      // Add topic tags
      episodeData.tags.forEach(tag => {
        if (tag.trim()) {
          tags.push(['t', tag.trim().toLowerCase()]);
        }
      });

      // Create and publish the event
      const event = await createEvent({
        kind: PODCAST_KINDS.EPISODE,
        content: episodeData.content || '',
        tags
      });

      // Invalidate related queries to refresh the UI
      await queryClient.invalidateQueries({ queryKey: ['podcast-episodes'] });
      await queryClient.invalidateQueries({ queryKey: ['podcast-stats'] });
      await queryClient.invalidateQueries({ queryKey: ['rss-feed-generator'] });

      return event.id;
    },

    onError: (error) => {
      console.error('Failed to publish episode:', error);
    }
  });
}

/**
 * Hook for updating/editing existing episodes
 */
export function useUpdateEpisode() {
  const { user } = useCurrentUser();
  const { mutateAsync: createEvent } = useNostrPublish();
  const { mutateAsync: uploadFile } = useUploadFile();
  const { nostr } = useNostr();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      episodeId,
      episodeIdentifier,
      episodeData
    }: {
      episodeId: string;
      episodeIdentifier: string;
      episodeData: EpisodeFormData;
    }): Promise<string> => {
      // Verify user is logged in and is the creator
      if (!user) {
        throw new Error('You must be logged in to update episodes');
      }

      if (!isPodcastCreator(user.pubkey)) {
        throw new Error('Only the podcast creator can update episodes');
      }

      // Upload new files if provided
      let audioUrl = episodeData.audioUrl;
      let audioType = episodeData.audioType;

      if (episodeData.audioFile) {
        try {
          const audioTags = await uploadFile(episodeData.audioFile);
          audioUrl = audioTags[0][1];
          audioType = episodeData.audioFile.type;
        } catch (error) {
          throw new Error(`Failed to upload audio file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      if (!audioUrl) {
        throw new Error('Audio URL or file is required');
      }

      // If we have a URL but no type, try to infer from file extension
      if (audioUrl && !audioType) {
        try {
          const url = new URL(audioUrl);
          const pathname = url.pathname.toLowerCase();
          if (pathname.endsWith('.mp3')) {
            audioType = 'audio/mpeg';
          } else if (pathname.endsWith('.wav')) {
            audioType = 'audio/wav';
          } else if (pathname.endsWith('.m4a')) {
            audioType = 'audio/mp4';
          } else if (pathname.endsWith('.ogg')) {
            audioType = 'audio/ogg';
          } else {
            audioType = 'audio/mpeg'; // Default fallback
          }
        } catch {
          audioType = 'audio/mpeg';
        }
      }

      let imageUrl = episodeData.imageUrl;
      if (episodeData.imageFile) {
        try {
          const imageTags = await uploadFile(episodeData.imageFile);
          imageUrl = imageTags[0][1];
        } catch (error) {
          throw new Error(`Failed to upload image file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Upload video file if provided
      let videoUrl = episodeData.videoUrl;
      let videoType = episodeData.videoType;
      if (episodeData.videoFile) {
        try {
          const videoTags = await uploadFile(episodeData.videoFile);
          videoUrl = videoTags[0][1];
          videoType = episodeData.videoFile.type;
        } catch (error) {
          throw new Error(`Failed to upload video file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Upload transcript file if provided
      let transcriptUrl = episodeData.transcriptUrl;
      const transcriptType = episodeData.transcriptType;
      if (episodeData.transcriptFile) {
        try {
          const transcriptTags = await uploadFile(episodeData.transcriptFile);
          transcriptUrl = transcriptTags[0][1];
        } catch (error) {
          throw new Error(`Failed to upload transcript file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Upload chapters file if provided
      let chaptersUrl = episodeData.chaptersUrl;
      if (episodeData.chaptersFile) {
        try {
          const chaptersTags = await uploadFile(episodeData.chaptersFile);
          chaptersUrl = chaptersTags[0][1];
        } catch (error) {
          throw new Error(`Failed to upload chapters file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Use the provided episode identifier to preserve the same addressable event
      // This ensures comments and other references remain linked to the same episode

      // Fetch the original episode to preserve its publication date
      let originalPubdate: string | undefined;
      try {
        const originalEvents = await nostr.query([{
          ids: [episodeId]
        }], { signal: AbortSignal.timeout(5000) });

        const originalEvent = originalEvents[0];
        if (originalEvent) {
          originalPubdate = originalEvent.tags.find(([name]) => name === 'pubdate')?.[1];
        }
      } catch (error) {
        console.warn('Could not fetch original episode for pubdate preservation:', error);
      }

      // Fallback to current time if no original pubdate found (for episodes created before this feature)
      const pubdate = originalPubdate || new Date().toUTCString();

      // Build tags for updated addressable podcast episode (kind 30054)
      const tags: Array<[string, ...string[]]> = [
        ['d', episodeIdentifier], // Preserve the original addressable event identifier
        ['title', episodeData.title], // Episode title
        ['audio', audioUrl, audioType || 'audio/mpeg'], // Audio URL with media type
        ['pubdate', pubdate], // Preserve original publication date
        ['alt', `Updated podcast episode: ${episodeData.title}`], // NIP-31 alt tag
        ['edit', episodeId] // Reference to the original event being edited
      ];

      // Add optional tags per NIP-54
      if (episodeData.description) {
        tags.push(['description', episodeData.description]);
      }

      if (imageUrl) {
        tags.push(['image', imageUrl]);
      }

      // Add video enclosure if provided
      if (videoUrl) {
        tags.push(['video', videoUrl, videoType || 'video/mp4']);
      }

      // Add transcript if provided (Podcasting 2.0)
      if (transcriptUrl) {
        tags.push(['transcript', transcriptUrl, transcriptType || 'text/plain']);
      }

      // Add chapters if provided (Podcasting 2.0)
      if (chaptersUrl) {
        tags.push(['chapters', chaptersUrl, 'application/json+chapters']);
      }

      // Add duration if provided
      if (episodeData.duration && episodeData.duration > 0) {
        tags.push(['duration', episodeData.duration.toString()]);
      }

      // Add topic tags
      episodeData.tags.forEach(tag => {
        if (tag.trim()) {
          tags.push(['t', tag.trim().toLowerCase()]);
        }
      });

      // Create the updated event
      const event = await createEvent({
        kind: PODCAST_KINDS.EPISODE,
        content: episodeData.content || '',
        tags
      });

      // Invalidate queries
      await queryClient.invalidateQueries({ queryKey: ['podcast-episodes'] });
      await queryClient.invalidateQueries({ queryKey: ['podcast-episode', episodeId] });
      await queryClient.invalidateQueries({ queryKey: ['podcast-stats'] });
      await queryClient.invalidateQueries({ queryKey: ['rss-feed-generator'] });

      return event.id;
    },
    onSuccess: (data) => {
      console.log('Episode update successful:', data);
    },
    onError: (error) => {
      console.error('Episode update failed:', error);
    },
    onSettled: (data, error) => {
      console.log('Episode update settled:', { data, error });
    }
  });
}

/**
 * Hook for deleting episodes (creates deletion event)
 */
export function useDeleteEpisode() {
  const { user } = useCurrentUser();
  const { mutateAsync: createEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (episodeId: string): Promise<string> => {
      if (!user) {
        throw new Error('You must be logged in to delete episodes');
      }

      if (!isPodcastCreator(user.pubkey)) {
        throw new Error('Only the podcast creator can delete episodes');
      }

      // Create a deletion event (NIP-09)
      const event = await createEvent({
        kind: 5, // Deletion event
        content: 'Deleted podcast episode',
        tags: [
          ['e', episodeId]
        ]
      });

      // Invalidate queries
      await queryClient.invalidateQueries({ queryKey: ['podcast-episodes'] });
      await queryClient.invalidateQueries({ queryKey: ['podcast-episode', episodeId] });
      await queryClient.invalidateQueries({ queryKey: ['podcast-stats'] });
      await queryClient.invalidateQueries({ queryKey: ['rss-feed-generator'] });

      return event.id;
    }
  });
}