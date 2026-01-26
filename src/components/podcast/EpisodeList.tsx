import { useState, useEffect, useMemo } from 'react';
import { useInView } from 'react-intersection-observer';
import { Search, SortAsc, SortDesc, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EpisodeCard } from './EpisodeCard';
import { useInfiniteEpisodes, usePodcastEpisodes } from '@/hooks/usePodcastEpisodes';
import type { PodcastEpisode, EpisodeSearchOptions } from '@/types/podcast';

interface EpisodeListProps {
  showSearch?: boolean;
  _showPlayer?: boolean;
  limit?: number;
  className?: string;
  onPlayEpisode?: (episode: PodcastEpisode) => void;
  _autoPlay?: boolean;
  /** Use infinite scroll for loading more episodes (default: true) */
  infiniteScroll?: boolean;
}

export function EpisodeList({
  showSearch = true,
  _showPlayer = true,
  limit = 10,
  className,
  onPlayEpisode,
  _autoPlay = false,
  infiniteScroll = true
}: EpisodeListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<EpisodeSearchOptions['sortBy']>('date');
  const [sortOrder, setSortOrder] = useState<EpisodeSearchOptions['sortOrder']>('desc');
  
  // Use intersection observer for infinite scroll trigger
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    rootMargin: '100px', // Start loading before reaching the end
  });

  // Use infinite query for infinite scroll mode
  const infiniteQuery = useInfiniteEpisodes({
    limit,
    query: searchQuery || undefined,
    sortBy,
    sortOrder,
  });

  // Use regular query for non-infinite mode (small lists)
  const regularQuery = usePodcastEpisodes({
    limit,
    query: searchQuery || undefined,
    sortBy,
    sortOrder,
    skipZaps: true, // Skip zaps for faster loading in simple mode
  });

  // Choose which query to use
  const query = infiniteScroll ? infiniteQuery : regularQuery;
  
  // Flatten pages for infinite scroll
  const episodes = useMemo(() => {
    if (infiniteScroll && infiniteQuery.data) {
      return infiniteQuery.data.pages.flatMap(page => page.episodes);
    }
    return regularQuery.data || [];
  }, [infiniteScroll, infiniteQuery.data, regularQuery.data]);

  const isLoading = query.isLoading;
  const isFetchingMore = infiniteScroll && infiniteQuery.isFetchingNextPage;
  const hasMore = infiniteScroll && infiniteQuery.hasNextPage;
  const error = query.error;

  // Trigger loading more when scrolling to the bottom
  useEffect(() => {
    if (inView && hasMore && !isFetchingMore && infiniteScroll) {
      infiniteQuery.fetchNextPage();
    }
  }, [inView, hasMore, isFetchingMore, infiniteScroll, infiniteQuery]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleSortChange = (newSortBy: string) => {
    setSortBy(newSortBy as EpisodeSearchOptions['sortBy']);
  };

  const handleSortOrderChange = () => {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
  };

  const handlePlayEpisode = (episode: PodcastEpisode) => {
    if (onPlayEpisode) {
      onPlayEpisode(episode);
    }
  };

  if (error) {
    return (
      <div className="col-span-full">
        <Card className="border-dashed">
          <CardContent className="py-12 px-8 text-center">
            <div className="max-w-sm mx-auto space-y-6">
              <p className="text-muted-foreground">
                Failed to load episodes. Please try refreshing the page.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={className}>
      {showSearch && (
        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search episodes..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Select value={sortBy} onValueChange={handleSortChange}>
                <SelectTrigger className="w-32">
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
                size="icon"
                onClick={handleSortOrderChange}
              >
                {sortOrder === 'desc' ? (
                  <SortDesc className="h-4 w-4" />
                ) : (
                  <SortAsc className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <Skeleton className="w-20 h-20 rounded-lg" />
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center space-x-2">
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                    <Skeleton className="h-6 w-3/4" />
                    <div className="flex items-center space-x-4">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : episodes && episodes.length > 0 ? (
        <div className="space-y-6">
          {episodes.map((episode) => (
            <EpisodeCard
              key={episode.id}
              episode={episode}
              onPlayEpisode={handlePlayEpisode}
            />
          ))}
          
          {/* Infinite scroll trigger */}
          {infiniteScroll && (
            <div ref={loadMoreRef} className="py-4">
              {isFetchingMore && (
                <div className="flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              {!hasMore && episodes.length > limit && (
                <p className="text-center text-sm text-muted-foreground">
                  All episodes loaded
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="col-span-full">
          <Card className="border-dashed">
            <CardContent className="py-12 px-8 text-center">
              <div className="max-w-sm mx-auto space-y-6">
                <p className="text-muted-foreground">
                  {searchQuery
                    ? `No episodes found for "${searchQuery}"`
                    : "No episodes published yet"
                  }
                </p>
                {!searchQuery && (
                  <p className="text-sm text-muted-foreground">
                    Episodes will appear here once the creator publishes them.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
