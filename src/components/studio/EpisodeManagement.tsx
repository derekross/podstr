import { useState, useEffect, useMemo } from 'react';
import { useInView } from 'react-intersection-observer';
import { format } from 'date-fns';
import {
  Edit,
  Trash2,
  Play,
  Pause,
  MoreHorizontal,
  Eye,
  ExternalLink,
  Calendar,
  Clock,
  Volume2,
  Tags,
  Hash,
  AlertTriangle,
  Plus,
  Share,
  Loader2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { encodeEpisodeAsNaddr } from '@/lib/nip19Utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useInfiniteEpisodes } from '@/hooks/usePodcastEpisodes';
import { useDeleteEpisode } from '@/hooks/usePublishEpisode';
import { useToast } from '@/hooks/useToast';
import { AudioPlayer } from '@/components/podcast/AudioPlayer';
import type { PodcastEpisode, EpisodeSearchOptions } from '@/types/podcast';
import { genRSSFeed } from '@/lib/rssGenerator';
import { usePodcastConfig } from '@/hooks/usePodcastConfig';
import { EpisodeEditDialog } from './EpisodeEditDialog';
import { ShareEpisodeDialog } from './ShareEpisodeDialog';

interface EpisodeManagementProps {
  className?: string;
}

export function EpisodeManagement({ className }: EpisodeManagementProps) {
  const { toast } = useToast();
  const podcastConfig = usePodcastConfig();
  const { mutateAsync: deleteEpisode, isPending: isDeleting } = useDeleteEpisode();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<EpisodeSearchOptions['sortBy']>('date');
  const [sortOrder, setSortOrder] = useState<EpisodeSearchOptions['sortOrder']>('desc');
  const [episodeToDelete, setEpisodeToDelete] = useState<PodcastEpisode | null>(null);
  const [episodeToEdit, setEpisodeToEdit] = useState<PodcastEpisode | null>(null);
  const [episodeToShare, setEpisodeToShare] = useState<PodcastEpisode | null>(null);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);

  // Intersection observer for infinite scroll
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    rootMargin: '100px',
  });

  // Use infinite query for episodes
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteEpisodes({
    limit: 15,
    query: searchQuery || undefined,
    sortBy,
    sortOrder,
  });

  // Flatten episodes from all pages
  const episodes = useMemo(() => {
    return data?.pages.flatMap(page => page.episodes) || [];
  }, [data]);

  // Trigger loading more when scrolling
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleSortChange = (newSortBy: string) => {
    setSortBy(newSortBy as EpisodeSearchOptions['sortBy']);
  };

  const handleSortOrderToggle = () => {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
  };

  const handleDeleteEpisode = async (episode: PodcastEpisode) => {
    try {
      await deleteEpisode(episode.eventId);

      // Regenerate RSS feed after deletion
      const updatedEpisodes = episodes?.filter(e => e.id !== episode.id) || [];
      await genRSSFeed(updatedEpisodes, podcastConfig);

      toast({
        title: 'Episode deleted',
        description: `"${episode.title}" has been deleted and RSS feed updated.`,
      });

      setEpisodeToDelete(null);
    } catch (error) {
      toast({
        title: 'Failed to delete episode',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleEpisodeUpdated = async () => {
    console.log('handleEpisodeUpdated called');
    try {
      // Regenerate RSS feed after update
      if (episodes) {
        console.log('Regenerating RSS feed...');
        await genRSSFeed(episodes, podcastConfig);
        console.log('RSS feed regenerated successfully');
      }
      setEpisodeToEdit(null);
      console.log('Episode edit dialog should close now');
    } catch (error) {
      console.error('Error in handleEpisodeUpdated:', error);
      // Still close the dialog even if RSS generation fails
      setEpisodeToEdit(null);
    }
  };

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

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="py-12 px-8 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-destructive" />
          <h3 className="text-lg font-semibold mb-2">Failed to load episodes</h3>
          <p className="text-muted-foreground mb-4">
            {error instanceof Error ? error.message : 'An error occurred while loading episodes'}
          </p>
          <Button onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Volume2 className="w-5 h-5" />
              <span>Episode Management</span>
              {episodes && (
                <Badge variant="secondary">
                  {episodes.length} episode{episodes.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </CardTitle>
            <Button asChild size="sm" className="text-sm">
              <Link to="/publish">
                <Plus className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">New Episode</span>
                <span className="sm:hidden">New</span>
              </Link>
            </Button>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div className="flex-1">
              <Input
                placeholder="Search episodes..."
                onChange={(e) => handleSearch(e.target.value)}
                className="max-w-md"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Select value={sortBy} onValueChange={handleSortChange}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="title">Title</SelectItem>
                  <SelectItem value="zaps">Zaps</SelectItem>
                  <SelectItem value="comments">Comments</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSortOrderToggle}
              >
                {sortOrder === 'desc' ? '↓' : '↑'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="border">
                  <CardContent className="p-6">
                    <div className="flex items-start space-x-4">
                      <Skeleton className="w-20 h-20 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                      <Skeleton className="w-8 h-8" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !episodes || episodes.length === 0 ? (
            <div className="text-center py-12">
              <Volume2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery ? 'No episodes found' : 'No episodes yet'}
              </h3>
              <p className="text-muted-foreground mb-6">
                {searchQuery
                  ? 'Try adjusting your search terms'
                  : 'Start by publishing your first episode'
                }
              </p>
              <Button asChild size="sm" className="text-sm">
                <Link to="/publish">
                  <Plus className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Publish First Episode</span>
                  <span className="sm:hidden">Publish Episode</span>
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {episodes.map((episode) => (
                <Card key={episode.id} className="border transition-colors hover:bg-muted/50">
                  <CardContent className="p-6">
                    <div className="flex items-start space-x-4">
                      {/* Episode Artwork */}
                      <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        {episode.imageUrl ? (
                          <img
                            src={episode.imageUrl}
                            alt={episode.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Volume2 className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      {/* Episode Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-lg truncate mb-1">
                              {episode.title}
                            </h3>
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-2">
                              {episode.episodeNumber && (
                                <span className="flex items-center space-x-1">
                                  <Hash className="w-3 h-3" />
                                  <span>Episode {episode.episodeNumber}</span>
                                </span>
                              )}
                              <span className="flex items-center space-x-1">
                                <Calendar className="w-3 h-3" />
                                <span>{format(episode.publishDate, 'MMM d, yyyy')}</span>
                              </span>
                              {episode.duration && (
                                <span className="flex items-center space-x-1">
                                  <Clock className="w-3 h-3" />
                                  <span>{formatDuration(episode.duration)}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Actions Dropdown */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => setCurrentlyPlaying(
                                  currentlyPlaying === episode.id ? null : episode.id
                                )}
                              >
                                {currentlyPlaying === episode.id ? (
                                  <Pause className="w-4 h-4 mr-2" />
                                ) : (
                                  <Play className="w-4 h-4 mr-2" />
                                )}
                                {currentlyPlaying === episode.id ? 'Hide Player' : 'Play Episode'}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEpisodeToEdit(episode)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit Episode
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link to={`/${encodeEpisodeAsNaddr(episode.authorPubkey, episode.identifier)}`}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  View Public Page
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEpisodeToShare(episode)}>
                                <Share className="w-4 h-4 mr-2" />
                                Share Episode
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  if (episode.audioUrl) {
                                    window.open(episode.audioUrl, '_blank');
                                  }
                                }}
                                disabled={!episode.audioUrl}
                              >
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Open Audio File
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setEpisodeToDelete(episode)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Episode
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Episode Description */}
                        {episode.description && (
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                            {episode.description}
                          </p>
                        )}

                        {/* Tags and Stats */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            {/* Tags */}
                            {episode.tags.length > 0 && (
                              <div className="flex items-center space-x-1">
                                <Tags className="w-3 h-3 text-muted-foreground" />
                                <div className="flex flex-wrap gap-1">
                                  {episode.tags.slice(0, 3).map((tag) => (
                                    <Badge key={tag} variant="outline" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                  {episode.tags.length > 3 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{episode.tags.length - 3}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Stats */}
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                            {episode.zapCount && episode.zapCount > 0 && (
                              <span className="flex items-center space-x-1">
                                <span className="text-yellow-500">⚡</span>
                                <span>{episode.zapCount}</span>
                              </span>
                            )}
                            {episode.commentCount && episode.commentCount > 0 && (
                              <span className="flex items-center space-x-1">
                                <span>💬</span>
                                <span>{episode.commentCount}</span>
                              </span>
                            )}
                            {episode.repostCount && episode.repostCount > 0 && (
                              <span className="flex items-center space-x-1">
                                <span>🔄</span>
                                <span>{episode.repostCount}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Audio Player */}
                        {currentlyPlaying === episode.id && (
                          <div className="mt-4 pt-4 border-t">
                            <AudioPlayer episode={episode} />
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {/* Infinite scroll trigger */}
              <div ref={loadMoreRef} className="py-4">
                {isFetchingNextPage && (
                  <div className="flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!hasNextPage && episodes.length > 15 && (
                  <p className="text-center text-sm text-muted-foreground">
                    All episodes loaded
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!episodeToDelete}
        onOpenChange={() => setEpisodeToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Episode</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{episodeToDelete?.title}"?
              This action cannot be undone and will also update your RSS feed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => episodeToDelete && handleDeleteEpisode(episodeToDelete)}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete Episode'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Episode Dialog */}
      {episodeToEdit && (
        <EpisodeEditDialog
          episode={episodeToEdit}
          open={!!episodeToEdit}
          onOpenChange={() => setEpisodeToEdit(null)}
          onSuccess={handleEpisodeUpdated}
        />
      )}

      {/* Share Episode Dialog */}
      <ShareEpisodeDialog
        episode={episodeToShare}
        open={!!episodeToShare}
        onOpenChange={() => setEpisodeToShare(null)}
      />
    </div>
  );
}