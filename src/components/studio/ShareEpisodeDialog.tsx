import { useState, useEffect } from 'react';
import { Share, Loader2, Send } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { encodeEpisodeAsNaddr } from '@/lib/nip19Utils';
import type { PodcastEpisode } from '@/types/podcast';

interface ShareEpisodeDialogProps {
  episode: PodcastEpisode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareEpisodeDialog({ episode, open, onOpenChange }: ShareEpisodeDialogProps) {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const { mutateAsync: createEvent, isPending } = useNostrPublish();
  
  // Generate the default share message
  const defaultMessage = episode ? 
    `Just published a new episode: "${episode.title}"\n\n${episode.description || ''}\n\n${window.location.origin}/${encodeEpisodeAsNaddr(episode.authorPubkey, episode.identifier)}\n\n#podcast #nostr` 
    : '';
    
  const [shareMessage, setShareMessage] = useState(defaultMessage);

  // Update the message when the episode changes
  useEffect(() => {
    if (episode) {
      const newMessage = `Just published a new episode: "${episode.title}"\n\n${episode.description || ''}\n\n${window.location.origin}/${encodeEpisodeAsNaddr(episode.authorPubkey, episode.identifier)}\n\n#podcast #nostr`;
      setShareMessage(newMessage);
    }
  }, [episode]);

  const handleShare = async () => {
    if (!episode || !user) return;

    try {
      // Create a kind 1 note (root post) sharing the episode
      await createEvent({
        kind: 1,
        content: shareMessage,
        tags: [
          ['a', `30054:${episode.authorPubkey}:${episode.identifier}`], // Reference the episode as addressable event (non-reply)
          ['t', 'podcast'], // Topic tag
          ['t', 'nostr'], // Topic tag
        ]
      });

      toast({
        title: "Episode shared!",
        description: "Your post has been published to Nostr.",
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Failed to share episode:', error);
      toast({
        title: "Failed to share episode",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  if (!episode) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Share className="w-5 h-5" />
            <span>Share Episode</span>
          </DialogTitle>
          <DialogDescription>
            Share this episode with your followers on Nostr.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="share-message">Post Content</Label>
            <Textarea
              id="share-message"
              placeholder="Write something about your episode..."
              value={shareMessage}
              onChange={(e) => setShareMessage(e.target.value)}
              rows={8}
              className="mt-2"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Share this episode with your followers on Nostr. You can edit the message above.
            </p>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleShare}
              disabled={isPending || !shareMessage.trim() || !user}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sharing...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Share Episode
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}