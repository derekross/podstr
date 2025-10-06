import { useState, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useSeoMeta } from '@unhead/react';
import { Clock, Calendar, ArrowLeft, Headphones, BookOpen, List, ExternalLink, ChevronDown, ChevronUp, Video } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { NoteContent } from '@/components/NoteContent';
import { EpisodeActions } from './EpisodeActions';
import { CommentsSection } from '@/components/comments/CommentsSection';
import { Layout } from '@/components/Layout';
import { Link, useNavigate } from 'react-router-dom';
import { useNostr } from '@nostrify/react';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { usePodcastConfig } from '@/hooks/usePodcastConfig';
import type { PodcastEpisode } from '@/types/podcast';
import type { NostrEvent } from '@nostrify/nostrify';

interface AddressableEventParams {
  pubkey: string;
  kind: number;
  identifier: string;
}

interface EpisodePageProps {
  eventId?: string; // For note1/nevent1
  addressableEvent?: AddressableEventParams; // For naddr1
}

export function EpisodePage({ eventId, addressableEvent }: EpisodePageProps) {
  const { nostr } = useNostr();
  const navigate = useNavigate();
  const { playEpisode } = useAudioPlayer();
  const podcastConfig = usePodcastConfig();
  const [showComments, setShowComments] = useState(true);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [isChaptersOpen, setIsChaptersOpen] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  // Query for the episode event
  const { data: episodeEvent, isLoading } = useQuery<NostrEvent | null>({
    queryKey: ['episode', eventId || `${addressableEvent?.pubkey}:${addressableEvent?.kind}:${addressableEvent?.identifier}`],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      if (eventId) {
        // Query by event ID (for note1/nevent1)
        const events = await nostr.query([{
          ids: [eventId],
          limit: 1
        }], { signal });
        return events[0] || null;
      } else if (addressableEvent) {
        // Query by addressable event coordinates (for naddr1)
        const events = await nostr.query([{
          kinds: [addressableEvent.kind],
          authors: [addressableEvent.pubkey],
          '#d': [addressableEvent.identifier],
          limit: 1
        }], { signal });
        
        // If we found the addressable event, return it
        if (events.length > 0) {
          return events[0];
        }
        
        // Fallback: For legacy episodes that don't have 'd' tags,
        // try to find by event ID if the identifier looks like an event ID (64 hex chars)
        if (/^[0-9a-f]{64}$/.test(addressableEvent.identifier)) {
          const legacyEvents = await nostr.query([{
            ids: [addressableEvent.identifier],
            kinds: [addressableEvent.kind],
            authors: [addressableEvent.pubkey],
            limit: 1
          }], { signal });
          return legacyEvents[0] || null;
        }
        
        return null;
      }

      return null;
    },
    staleTime: 60000, // 1 minute
    enabled: !!(eventId || addressableEvent)
  });

  // Convert NostrEvent to PodcastEpisode format (NIP-54) - memoized to prevent unnecessary re-renders
  const episode: PodcastEpisode | null = useMemo(() => {
    if (!episodeEvent) return null;

    const tags = new Map(episodeEvent.tags.map(([key, ...values]) => [key, values]));

    const title = tags.get('title')?.[0] || 'Untitled Episode';
    const description = tags.get('description')?.[0] || '';
    const imageUrl = tags.get('image')?.[0] || '';

    // Extract audio URL and type from audio tag (NIP-54 format)
    const audioTag = tags.get('audio');
    const audioUrl = audioTag?.[0] || '';
    const audioType = audioTag?.[1] || 'audio/mpeg';

    // Extract video URL and type from video tag
    const videoTag = tags.get('video');
    const videoUrl = videoTag?.[0];
    const videoType = videoTag?.[1];

    // Extract all 't' tags for topics
    const topicTags = episodeEvent.tags
      .filter(([name]) => name === 't')
      .map(([, value]) => value);

    // Extract identifier from 'd' tag (for addressable events)
    // CRITICAL: This must match the logic used everywhere else in the app
    const identifier = tags.get('d')?.[0] || episodeEvent.id;

    // Extract duration from tag
    const durationStr = tags.get('duration')?.[0];
    const duration = durationStr ? parseInt(durationStr, 10) : undefined;

    // Extract publication date from pubdate tag with fallback to created_at
    const pubdateStr = tags.get('pubdate')?.[0];
    let publishDate: Date;
    try {
      publishDate = pubdateStr ? new Date(pubdateStr) : new Date(episodeEvent.created_at * 1000);
    } catch {
      publishDate = new Date(episodeEvent.created_at * 1000);
    }

    // Extract transcript URL from tag
    const transcriptUrl = tags.get('transcript')?.[0];

    // Extract chapters URL from tag
    const chaptersUrl = tags.get('chapters')?.[0];

    return {
      id: episodeEvent.id,
      eventId: episodeEvent.id,
      title,
      description,
      content: episodeEvent.content,
      authorPubkey: episodeEvent.pubkey,
      identifier,
      audioUrl,
      audioType,
      videoUrl,
      videoType,
      imageUrl,
      publishDate,
      createdAt: new Date(episodeEvent.created_at * 1000),
      episodeNumber: undefined, // Can be extended later if needed
      seasonNumber: undefined, // Can be extended later if needed
      duration,
      explicit: false, // Can be extended later if needed
      tags: topicTags,
      transcriptUrl,
      chaptersUrl,
      zapCount: 0,
      commentCount: 0,
      repostCount: 0
    };
  }, [episodeEvent]);

  // Fetch transcript content if URL is available
  const { data: transcriptContent, isLoading: isLoadingTranscript } = useQuery<string | null>({
    queryKey: ['transcript', episode?.transcriptUrl],
    queryFn: async () => {
      if (!episode?.transcriptUrl) return null;

      try {
        const response = await fetch(episode.transcriptUrl);
        if (!response.ok) throw new Error('Failed to fetch transcript');
        return await response.text();
      } catch (error) {
        console.error('Error fetching transcript:', error);
        return null;
      }
    },
    enabled: !!episode?.transcriptUrl,
    staleTime: 300000, // 5 minutes
  });

  // Fetch chapters content if URL is available
  const { data: chaptersContent, isLoading: isLoadingChapters } = useQuery<Array<{ startTime: number; title: string; img?: string; url?: string }> | null>({
    queryKey: ['chapters', episode?.chaptersUrl],
    queryFn: async () => {
      if (!episode?.chaptersUrl) return null;

      try {
        const response = await fetch(episode.chaptersUrl);
        if (!response.ok) throw new Error('Failed to fetch chapters');
        const data = await response.json();

        // Handle both formats:
        // 1. Podcasting 2.0 format: { "version": "1.2.0", "chapters": [...] }
        // 2. Simple array format: [...]
        if (Array.isArray(data)) {
          return data;
        } else if (data && typeof data === 'object' && Array.isArray(data.chapters)) {
          return data.chapters;
        }

        return null;
      } catch (error) {
        console.error('Error fetching chapters:', error);
        return null;
      }
    },
    enabled: !!episode?.chaptersUrl,
    staleTime: 300000, // 5 minutes
  });

  // Update document title when episode loads
  useSeoMeta({
    title: episode 
      ? `${episode.title} | ${podcastConfig.podcast.title}`
      : `Episode | ${podcastConfig.podcast.title}`,
  });

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            <Card>
              <CardHeader>
                <div className="flex items-start space-x-4">
                  <Skeleton className="w-32 h-32 rounded-lg" />
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center space-x-2">
                      <Skeleton className="h-6 w-24" />
                      <Skeleton className="h-6 w-16" />
                    </div>
                    <Skeleton className="h-8 w-3/4" />
                    <div className="flex items-center space-x-4">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-3/5" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </Layout>
    );
  }

  if (!episode) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            <Card>
              <CardContent className="py-12 text-center">
                <h2 className="text-xl font-semibold mb-2">Episode Not Found</h2>
                <p className="text-muted-foreground mb-4">
                  This episode doesn't exist or hasn't been published yet.
                </p>
                <Button asChild>
                  <Link to="/episodes">Browse All Episodes</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Episodes
          </Button>

          {/* Episode Header */}
          <Card>
            <CardHeader>
              <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
                {episode.imageUrl && (
                  <img
                    src={episode.imageUrl}
                    alt={episode.title}
                    className="w-32 h-32 lg:w-48 lg:h-48 rounded-lg object-cover flex-shrink-0 shadow-lg"
                  />
                )}

                <div className="flex-1 min-w-0 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {episode.episodeNumber && (
                      <Badge variant="secondary">
                        Episode {episode.episodeNumber}
                      </Badge>
                    )}
                    {episode.seasonNumber && (
                      <Badge variant="outline">
                        Season {episode.seasonNumber}
                      </Badge>
                    )}
                    {episode.explicit && (
                      <Badge variant="destructive">Explicit</Badge>
                    )}
                  </div>

                  <CardTitle className="text-2xl lg:text-3xl">
                    {episode.title}
                  </CardTitle>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDistanceToNow(episode.publishDate, { addSuffix: true })}</span>
                    </div>

                    {episode.duration && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{formatDuration(episode.duration)}</span>
                      </div>
                    )}
                  </div>

                  {episode.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {episode.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Episode Description */}
              {episode.description && (
                <div>
                  <p className="text-muted-foreground leading-relaxed">
                    {episode.description}
                  </p>
                </div>
              )}

              {/* Episode Content */}
              {episode.content && (
                <div className="prose prose-sm max-w-none">
                  <NoteContent
                    event={episodeEvent!}
                    className="text-sm"
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-4 border-t">
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => {
                      if (episode.audioUrl) {
                        playEpisode(episode);
                      }
                    }}
                    disabled={!episode.audioUrl}
                    className="flex items-center gap-2"
                  >
                    <Headphones className="w-4 h-4" />
                    Listen Now
                  </Button>

                  {episode.videoUrl && (
                    <Button
                      onClick={() => setShowVideo(!showVideo)}
                      variant="secondary"
                      className="flex items-center gap-2"
                    >
                      <Video className="w-4 h-4" />
                      {showVideo ? 'Hide Video' : 'Watch Video'}
                    </Button>
                  )}

                  {!episode.audioUrl && !episode.videoUrl && (
                    <p className="text-sm text-muted-foreground">
                      No media available
                    </p>
                  )}
                </div>

                {/* Social Actions */}
                <EpisodeActions
                  episode={episode}
                  showComments={showComments}
                  onToggleComments={() => setShowComments(!showComments)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Video Player Section */}
          {showVideo && episode.videoUrl && (
            <Card>
              <CardContent className="p-0">
                <video
                  controls
                  className="w-full aspect-video"
                >
                  <source src={episode.videoUrl} type={episode.videoType || 'video/mp4'} />
                  Your browser does not support the video tag.
                </video>
              </CardContent>
            </Card>
          )}

          {/* Chapters Section */}
          {episode.chaptersUrl && (
            <Card>
              <Collapsible open={isChaptersOpen} onOpenChange={setIsChaptersOpen}>
                <CardHeader className="pb-3">
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center justify-between w-full text-left hover:opacity-80 transition-opacity">
                      <CardTitle className="flex items-center gap-2">
                        <List className="w-5 h-5" />
                        Chapters
                        {chaptersContent && (
                          <Badge variant="secondary" className="ml-2">
                            {chaptersContent.length}
                          </Badge>
                        )}
                      </CardTitle>
                      {isChaptersOpen ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent>
                    {isLoadingChapters ? (
                      <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <Skeleton className="w-16 h-16 rounded flex-shrink-0" />
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-4 w-24" />
                              <Skeleton className="h-4 w-full" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : chaptersContent && chaptersContent.length > 0 ? (
                      <div className="space-y-3">
                        {chaptersContent.map((chapter, index) => (
                          <div
                            key={index}
                            className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => {
                              // TODO: Seek to chapter time in audio player
                              console.log('Seek to:', chapter.startTime);
                            }}
                          >
                            {chapter.img && (
                              <img
                                src={chapter.img}
                                alt={chapter.title}
                                className="w-16 h-16 rounded object-cover flex-shrink-0"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2">
                                <span className="text-sm font-medium text-muted-foreground">
                                  {formatDuration(chapter.startTime)}
                                </span>
                                <h3 className="font-semibold truncate">{chapter.title}</h3>
                              </div>
                              {chapter.url && (
                                <a
                                  href={chapter.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-primary hover:underline flex items-center gap-1 mt-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Learn more
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground mb-4">Failed to load chapters</p>
                        <a
                          href={episode.chaptersUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-primary hover:underline"
                        >
                          <ExternalLink className="w-4 h-4" />
                          View Chapters File
                        </a>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          )}

          {/* Transcript Section */}
          {episode.transcriptUrl && (
            <Card>
              <Collapsible open={isTranscriptOpen} onOpenChange={setIsTranscriptOpen}>
                <CardHeader className="pb-3">
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center justify-between w-full text-left hover:opacity-80 transition-opacity">
                      <CardTitle className="flex items-center gap-2">
                        <BookOpen className="w-5 h-5" />
                        Transcript
                      </CardTitle>
                      {isTranscriptOpen ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent>
                    {isLoadingTranscript ? (
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                      </div>
                    ) : transcriptContent ? (
                      <div className="prose prose-sm max-w-none">
                        <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg overflow-x-auto max-h-[600px] overflow-y-auto">
                          {transcriptContent}
                        </pre>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground mb-4">Failed to load transcript</p>
                        <a
                          href={episode.transcriptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-primary hover:underline"
                        >
                          <ExternalLink className="w-4 h-4" />
                          View Transcript File
                        </a>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          )}


          {/* Comments Section */}
          {showComments && (
            <Card>
              <CardContent className="pt-6">
                {episode ? (
                  <CommentsSection
                    root={{
                      id: episode.eventId,
                      pubkey: episode.authorPubkey,
                      created_at: Math.floor(episode.createdAt.getTime() / 1000),
                      kind: 30054,
                      tags: [
                        ['d', episode.identifier], // Use the extracted identifier, not the raw event's d tag
                        ['title', episode.title],
                        ['audio', episode.audioUrl, episode.audioType || 'audio/mpeg'],
                        ...(episode.description ? [['description', episode.description]] : []),
                        ...(episode.imageUrl ? [['image', episode.imageUrl]] : []),
                        ...episode.tags.map(tag => ['t', tag])
                      ],
                      content: episode.content || '',
                      sig: ''
                    }}
                    title="Episode Discussion"
                    emptyStateMessage="No comments yet"
                    emptyStateSubtitle="Be the first to share your thoughts about this episode!"
                    limit={100}
                  />
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Unable to load comments for this episode.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}