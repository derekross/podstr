import { useMemo } from 'react';
import { type NostrEvent } from '@nostrify/nostrify';
import { Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { ProfileMention } from '@/components/ProfileMention';
import { InlineEmbeddedEvent } from '@/components/InlineEmbeddedEvent';
import { extractMediaFromEvent, getMediaTypeFromUrl } from '@/lib/mediaUtils';
import { cn } from '@/lib/utils';

interface NoteContentProps {
  event: NostrEvent;
  className?: string;
}

/** Parses content of text note events so that URLs and hashtags are linkified. */
export function NoteContent({
  event,
  className,
}: NoteContentProps) {
  // Process the content to render mentions, links, etc.
  const content = useMemo(() => {
    const text = event.content;

    // Extract media URLs from the event to avoid showing them as text links
    const mediaItems = extractMediaFromEvent(event);
    const mediaUrls = new Set(mediaItems.map(item => item.url));

    // Regex to find URLs, Nostr references, and hashtags
    const regex = /(https?:\/\/[^\s]+)|nostr:(npub1|note1|nprofile1|nevent1|naddr1)([023456789acdefghjklmnpqrstuvwxyz]+)|(#\w+)/g;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let keyCounter = 0;

    while ((match = regex.exec(text)) !== null) {
      const [fullMatch, url, nostrPrefix, nostrData, hashtag] = match;
      const index = match.index;

      // Add text before this match
      if (index > lastIndex) {
        parts.push(text.substring(lastIndex, index));
      }

      if (url) {
        // Skip URLs that are already being rendered as media
        if (mediaUrls.has(url) || getMediaTypeFromUrl(url)) {
          // Don't add anything to parts - completely skip media URLs
        } else {
          // Handle URLs
          // Truncate very long URLs for display while keeping full URL in href
          const displayUrl = url.length > 60 ? `${url.slice(0, 60)}...` : url;

          parts.push(
            <a
              key={`url-${keyCounter++}`}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline break-all inline-block max-w-full"
              title={url} // Show full URL on hover
            >
              {displayUrl}
            </a>
          );
        }
      } else if (nostrPrefix && nostrData) {
        // Handle Nostr references
        try {
          const nostrId = `${nostrPrefix}${nostrData}`;
          const decoded = nip19.decode(nostrId);

          if (decoded.type === 'npub' || decoded.type === 'nprofile') {
            // Render profile mentions with @username
            parts.push(
              <ProfileMention key={`mention-${keyCounter++}`} identifier={nostrId} />
            );
          } else if (decoded.type === 'note' || decoded.type === 'nevent') {
            // Render embedded events inline
            parts.push(
              <InlineEmbeddedEvent key={`embed-${keyCounter++}`} identifier={nostrId} />
            );
          } else {
            // For other types (like naddr), show as a link
            parts.push(
              <Link
                key={`nostr-${keyCounter++}`}
                to={`/${nostrId}`}
                className="text-blue-500 hover:underline"
              >
                {fullMatch}
              </Link>
            );
          }
        } catch {
          // If decoding fails, just render as text
          parts.push(fullMatch);
        }
      } else if (hashtag) {
        // Handle hashtags
        const tag = hashtag.slice(1); // Remove the #
        parts.push(
          <Link
            key={`hashtag-${keyCounter++}`}
            to={`/t/${tag}`}
            className="text-blue-500 hover:underline"
          >
            {hashtag}
          </Link>
        );
      }

      lastIndex = index + fullMatch.length;
    }

    // Add any remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    // If no special content was found, just use the plain text
    if (parts.length === 0) {
      parts.push(text);
    }

    return parts;
  }, [event]);

  return (
    <div className={cn("whitespace-pre-wrap break-words overflow-hidden", className)}>
      {content.length > 0 ? content : event.content}
    </div>
  );
}

