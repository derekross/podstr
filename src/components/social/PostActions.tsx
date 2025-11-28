import { useState } from 'react';
import { MessageCircle, Repeat, Heart, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ZapButton } from '@/components/ZapButton';
import { NoteContent } from '@/components/NoteContent';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { useNostr } from '@nostrify/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { nip19 } from 'nostr-tools';
import type { NostrEvent } from '@nostrify/nostrify';
import { cn } from '@/lib/utils';

interface InteractionCounts {
  replies: number;
  reposts: number;
  likes: number;
  zaps: number;
  totalSats: number;
}

interface UserInteractions {
  hasLiked: boolean;
  hasReposted: boolean;
}

interface PostActionsProps {
  event: NostrEvent;
  className?: string;
}

export function PostActions({ event, className }: PostActionsProps) {
  const { user } = useCurrentUser();
  const { mutate: createEvent } = useNostrPublish();
  const { toast } = useToast();
  const { nostr } = useNostr();
  const queryClient = useQueryClient();

  const [replyDialogOpen, setReplyDialogOpen] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  // Query for user's interactions with this event
  const { data: userInteractions } = useQuery<UserInteractions>({
    queryKey: ['user-interactions', event.id, user?.pubkey],
    queryFn: async (c) => {
      if (!user?.pubkey) return { hasLiked: false, hasReposted: false };

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);

      // Query for user's likes and reposts of this event
      const interactions = await nostr.query([{
        kinds: [6, 7, 16], // Reposts, likes, and generic reposts
        authors: [user.pubkey],
        '#e': [event.id],
        limit: 10
      }], { signal });

      const hasLiked = interactions.some(e => e.kind === 7);
      const hasReposted = interactions.some(e => e.kind === 6 || e.kind === 16);

      return { hasLiked, hasReposted };
    },
    enabled: !!user?.pubkey,
    staleTime: 30000, // 30 seconds
  });

  // Query for interaction counts
  const { data: interactionCounts } = useQuery<InteractionCounts>({
    queryKey: ['interaction-counts', event.id],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);

      // Query for all interactions with this event (including zaps)
      const interactions = await nostr.query([{
        kinds: [1, 6, 7, 9735, 16], // Replies, reposts, likes, zaps, generic reposts
        '#e': [event.id],
        limit: 500
      }], { signal });

      const replies = interactions.filter(e => e.kind === 1).length;
      const reposts = interactions.filter(e => e.kind === 6 || e.kind === 16).length;
      const likes = interactions.filter(e => e.kind === 7).length;
      
      // Count zaps and calculate total sats
      const { extractZapAmount, validateZapEvent } = await import('@/lib/zapUtils');
      const zaps = interactions.filter(e => e.kind === 9735).filter(validateZapEvent);
      const zapCount = zaps.length;
      const totalSats = zaps.reduce((total, zap) => {
        // Use our consistent zap amount extraction utility
        const amount = extractZapAmount(zap);
        return total + amount;
      }, 0);

      return { replies, reposts, likes, zaps: zapCount, totalSats };
    },
    staleTime: 60000, // 1 minute
  });

  const handleReply = async () => {
    if (!user || !replyContent.trim()) return;

    setIsSubmittingReply(true);
    try {
      // Determine proper reply tagging based on NIP-10
      const replyTags: string[][] = [];
      const pTags: string[][] = [];

      // Check if this event is already a reply (has e tags)
      const eTags = event.tags.filter(tag => tag[0] === 'e');
      
      if (eTags.length === 0) {
        // This is a root event, so we're making a direct reply to root
        replyTags.push(['e', event.id, '', 'root']);
      } else {
        // This event is already a reply, so we need to find the root and set this as immediate parent
        const rootTag = eTags.find(tag => tag[3] === 'root');
        
        if (rootTag) {
          // Preserve the root tag
          replyTags.push(['e', rootTag[1], '', 'root']);
        } else {
          // Fallback: treat first e tag as root if no root marker found (older events)
          replyTags.push(['e', eTags[0][1], '', 'root']);
        }
        
        // Add current event as the immediate reply parent
        replyTags.push(['e', event.id, '', 'reply']);
      }

      // Add the author of the event being replied to
      pTags.push(['p', event.pubkey]);

      // Add all existing p tags from the event being replied to (thread participants)
      const existingPTags = event.tags.filter(tag => tag[0] === 'p');
      for (const pTag of existingPTags) {
        // Only add if not already included
        if (!pTags.some(existing => existing[1] === pTag[1])) {
          pTags.push(['p', pTag[1]]);
        }
      }

      // Optimistically update interaction counts FIRST
      queryClient.setQueryData(['interaction-counts', event.id], (old: InteractionCounts | undefined) => {
        if (!old) return { replies: 1, reposts: 0, likes: 0, zaps: 0, totalSats: 0 };
        return { ...old, replies: old.replies + 1 };
      });

      // Publish the event
      await createEvent({
        kind: 1,
        content: replyContent,
        tags: [...replyTags, ...pTags]
      });

      setReplyContent('');
      setReplyDialogOpen(false);

      // Delay invalidation to allow network propagation
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['interaction-counts', event.id] });
        queryClient.invalidateQueries({ queryKey: ['creator-replies'] });
      }, 2000); // 2 second delay

      toast({
        title: "Reply posted!",
        description: "Your reply has been published to the network.",
      });
    } catch {
      // Revert optimistic updates on error
      queryClient.setQueryData(['interaction-counts', event.id], (old: InteractionCounts | undefined) => {
        if (!old) return { replies: 0, reposts: 0, likes: 0, zaps: 0, totalSats: 0 };
        return { ...old, replies: Math.max(0, old.replies - 1) };
      });

      toast({
        title: "Failed to post reply",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleRepost = async () => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please log in to repost.",
        variant: "destructive",
      });
      return;
    }

    if (userInteractions?.hasReposted) {
      toast({
        title: "Already reposted",
        description: "You have already reposted this note.",
      });
      return;
    }

    try {
      // Optimistically update user interactions FIRST
      queryClient.setQueryData(['user-interactions', event.id, user.pubkey], (old: UserInteractions | undefined) => {
        if (!old) return { hasLiked: false, hasReposted: true };
        return { ...old, hasReposted: true };
      });

      // Optimistically update interaction counts
      queryClient.setQueryData(['interaction-counts', event.id], (old: InteractionCounts | undefined) => {
        if (!old) return { replies: 0, reposts: 1, likes: 0, zaps: 0, totalSats: 0 };
        return { ...old, reposts: old.reposts + 1 };
      });

      // Publish the event
      await createEvent({
        kind: 16, // Use generic repost (kind 16) instead of legacy repost (kind 6)
        content: '',
        tags: [
          ['e', event.id],
          ['p', event.pubkey],
          ['k', event.kind.toString()] // Include the kind of the event being reposted
        ]
      });

      toast({
        title: "Reposted!",
        description: "Your repost has been published to the network.",
      });

      // Delay invalidation to allow network propagation
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['user-interactions', event.id, user.pubkey] });
        queryClient.invalidateQueries({ queryKey: ['interaction-counts', event.id] });
        queryClient.invalidateQueries({ queryKey: ['creator-reposts'] });
      }, 2000); // 2 second delay
    } catch {
      // Revert optimistic updates on error
      queryClient.setQueryData(['user-interactions', event.id, user.pubkey], (old: UserInteractions | undefined) => {
        if (!old) return { hasLiked: false, hasReposted: false };
        return { ...old, hasReposted: false };
      });

      queryClient.setQueryData(['interaction-counts', event.id], (old: InteractionCounts | undefined) => {
        if (!old) return { replies: 0, reposts: 0, likes: 0, zaps: 0, totalSats: 0 };
        return { ...old, reposts: Math.max(0, old.reposts - 1) };
      });

      toast({
        title: "Failed to repost",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleLike = async () => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please log in to like.",
        variant: "destructive",
      });
      return;
    }

    if (userInteractions?.hasLiked) {
      toast({
        title: "Already liked",
        description: "You have already liked this note.",
      });
      return;
    }

    try {
      // Optimistically update user interactions FIRST
      queryClient.setQueryData(['user-interactions', event.id, user.pubkey], (old: UserInteractions | undefined) => {
        if (!old) return { hasLiked: true, hasReposted: false };
        return { ...old, hasLiked: true };
      });

      // Optimistically update interaction counts
      queryClient.setQueryData(['interaction-counts', event.id], (old: InteractionCounts | undefined) => {
        if (!old) return { replies: 0, reposts: 0, likes: 1, zaps: 0, totalSats: 0 };
        return { ...old, likes: old.likes + 1 };
      });

      // Publish the event
      await createEvent({
        kind: 7,
        content: '+',
        tags: [
          ['e', event.id],
          ['p', event.pubkey]
        ]
      });

      toast({
        title: "Liked!",
        description: "Your like has been published to the network.",
      });

      // Delay invalidation to allow network propagation
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['user-interactions', event.id, user.pubkey] });
        queryClient.invalidateQueries({ queryKey: ['interaction-counts', event.id] });
      }, 2000); // 2 second delay
    } catch {
      // Revert optimistic updates on error
      queryClient.setQueryData(['user-interactions', event.id, user.pubkey], (old: UserInteractions | undefined) => {
        if (!old) return { hasLiked: false, hasReposted: false };
        return { ...old, hasLiked: false };
      });

      queryClient.setQueryData(['interaction-counts', event.id], (old: InteractionCounts | undefined) => {
        if (!old) return { replies: 0, reposts: 0, likes: 0, zaps: 0, totalSats: 0 };
        return { ...old, likes: Math.max(0, old.likes - 1) };
      });

      toast({
        title: "Failed to like",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleShare = async () => {
    try {
      const nevent = nip19.neventEncode({
        id: event.id,
        author: event.pubkey,
      });
      const url = `${window.location.origin}/${nevent}`;

      await navigator.clipboard.writeText(url);

      toast({
        title: "Link copied!",
        description: "The event link has been copied to your clipboard.",
      });
    } catch {
      toast({
        title: "Failed to copy link",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className={cn("flex items-center space-x-4", className)}>
      {/* Reply Button */}
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-blue-500"
        onClick={() => setReplyDialogOpen(true)}
      >
        <MessageCircle className="w-4 h-4 mr-1" />
        <span className="text-xs">
          {interactionCounts?.replies || 0}
        </span>
      </Button>

      {/* Repost Button */}
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "text-muted-foreground hover:text-green-500",
          userInteractions?.hasReposted && "text-green-500"
        )}
        onClick={handleRepost}
      >
        <Repeat className="w-4 h-4 mr-1" />
        <span className="text-xs">
          {interactionCounts?.reposts || 0}
        </span>
      </Button>

      {/* Like Button */}
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "text-muted-foreground hover:text-red-500",
          userInteractions?.hasLiked && "text-red-500"
        )}
        onClick={handleLike}
      >
        <Heart className={cn(
          "w-4 h-4 mr-1",
          userInteractions?.hasLiked && "fill-current"
        )} />
        <span className="text-xs">
          {interactionCounts?.likes || 0}
        </span>
      </Button>

      {/* Zap Button */}
      <ZapButton
        target={event}
        className="text-xs"
        zapData={{
          count: interactionCounts?.zaps || 0,
          totalSats: interactionCounts?.totalSats || 0,
          isLoading: false
        }}
        onZapSuccess={(amount: number) => {
          // Optimistically update interaction counts when zap succeeds
          queryClient.setQueryData(['interaction-counts', event.id], (old: InteractionCounts | undefined) => {
            if (!old) return { replies: 0, reposts: 0, likes: 0, zaps: 1, totalSats: amount };
            return { ...old, zaps: old.zaps + 1, totalSats: old.totalSats + amount };
          });
        }}
      />

      {/* Share Button */}
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-blue-500"
        onClick={handleShare}
      >
        <Share className="w-4 h-4" />
      </Button>

      {/* Reply Dialog */}
      <Dialog open={replyDialogOpen} onOpenChange={setReplyDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reply to Note</DialogTitle>
            <DialogDescription>
              Write a reply to this note.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-muted p-3 rounded-lg overflow-hidden">
              <div className="text-sm text-muted-foreground line-clamp-3">
                <NoteContent event={event} className="text-sm text-muted-foreground" />
              </div>
            </div>

            <Textarea
              placeholder="Write your reply..."
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              className="min-h-[100px]"
            />

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setReplyDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleReply}
                disabled={!replyContent.trim() || isSubmittingReply}
              >
                {isSubmittingReply ? "Posting..." : "Reply"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}