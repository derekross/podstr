import { formatDistanceToNow } from 'date-fns';
import { Repeat, MessageSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { PostCard } from './PostCard';
import { extractRepostData, type RepostData } from '@/lib/mediaUtils';
import type { NostrEvent } from '@nostrify/nostrify';
import { isSafeUrl } from '@/lib/utils';

interface RepostCardProps {
  event: NostrEvent;
  className?: string;
}

export function RepostCard({ event, className }: RepostCardProps) {
  const { data: reposter } = useAuthor(event.pubkey);
  const reposterMetadata = reposter?.metadata;
  const reposterName = reposterMetadata?.name || reposterMetadata?.display_name || genUserName(event.pubkey);
  
  const repostDate = new Date(event.created_at * 1000);
  const repostData = extractRepostData(event);

  if (!repostData) {
    // Fallback to regular post card if repost data can't be extracted
    return <PostCard event={event} className={className} />;
  }

  return (
    <div className={className}>
      {/* Repost Header */}
      <div className="flex items-center space-x-2 mb-3 text-sm text-muted-foreground">
        <Repeat className="w-4 h-4 text-green-600" />
        <Avatar className="w-5 h-5">
          <AvatarImage src={reposterMetadata?.picture} alt={reposterName} />
          <AvatarFallback className="text-xs">
            {reposterName.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span>
          <span className="font-medium">
            {reposterName}
          </span>
          {' '}reposted
        </span>
        <span>•</span>
        <time>
          {formatDistanceToNow(repostDate, { addSuffix: true })}
        </time>
      </div>

      {/* Repost Comment (if any) */}
      {event.content.trim() && (
        <Card className="mb-3 bg-muted/20">
          <CardContent className="p-3">
            <p className="text-sm">{event.content}</p>
          </CardContent>
        </Card>
      )}

      {/* Original Event */}
      <OriginalEventCard repostData={repostData} />
    </div>
  );
}

interface OriginalEventCardProps {
  repostData: RepostData;
}

function OriginalEventCard({ repostData }: OriginalEventCardProps) {
  const { nostr } = useNostr();

  const { data: originalEvent, isLoading, error } = useQuery({
    queryKey: ['original-event', repostData.originalEventId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(1500)]);
      const events = await nostr.query([{ ids: [repostData.originalEventId] }], { signal });
      return events[0] || null;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  if (isLoading) {
    return <OriginalEventSkeleton />;
  }

  if (error || !originalEvent) {
    return <OriginalEventPlaceholder repostData={repostData} />;
  }

  // Render the original event as a nested post card with slight styling differences
  return (
    <div className="border-l-2 border-l-muted pl-4">
      <PostCard event={originalEvent} className="shadow-none border-muted bg-background" />
    </div>
  );
}

function OriginalEventSkeleton() {
  return (
    <div className="border-l-2 border-l-muted pl-4">
      <Card className="shadow-none border-muted">
        <CardContent className="p-6">
          <div className="flex items-start space-x-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="flex-1 space-y-3">
              <div className="flex items-center space-x-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <div className="flex items-center space-x-4 pt-2">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-16" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function OriginalEventPlaceholder({ repostData }: OriginalEventCardProps) {
  const { data: originalAuthor } = useAuthor(repostData.originalAuthorPubkey || '');
  const originalAuthorMetadata = originalAuthor?.metadata;
  const originalAuthorName = originalAuthorMetadata?.name || 
                            originalAuthorMetadata?.display_name || 
                            (repostData.originalAuthorPubkey ? genUserName(repostData.originalAuthorPubkey) : 'Unknown');

  return (
    <div className="border-l-2 border-l-muted pl-4">
      <Card className="shadow-none border-dashed border-muted">
        <CardContent className="p-6 text-center">
          <div className="space-y-3">
            <div className="flex items-center justify-center space-x-2">
              <MessageSquare className="w-5 h-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Unable to load original event
              </p>
            </div>
            
            {repostData.originalAuthorPubkey && (
              <p className="text-xs text-muted-foreground">
                Originally posted by {originalAuthorName}
              </p>
            )}
            
            <div className="flex justify-center space-x-2">
              <Button variant="outline" size="sm" asChild>
                <a 
                  href={`https://njump.me/${repostData.originalEventId}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  View on njump.me
                </a>
              </Button>
              
              {repostData.relayUrl && isSafeUrl(repostData.relayUrl) && (
                <Button variant="outline" size="sm" asChild>
                  <a 
                    href={repostData.relayUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    Check Relay
                  </a>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}