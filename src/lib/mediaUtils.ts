import type { NostrEvent } from '@nostrify/nostrify';
import { isSafeUrl } from '@/lib/utils';

export interface MediaItem {
  url: string;
  type: 'image' | 'video' | 'audio';
  mimeType?: string;
  size?: number;
  hash?: string;
}

export interface RepostData {
  originalEventId: string;
  originalAuthorPubkey?: string;
  relayUrl?: string;
  kind?: number;
}

/**
 * Extract media files from event tags (NIP-94 imeta tags)
 */
export function extractMediaFromEvent(event: NostrEvent): MediaItem[] {
  const media: MediaItem[] = [];
  
  // Parse imeta tags for attached media
  for (const tag of event.tags) {
    if (tag[0] === 'imeta') {
      const mediaItem: Partial<MediaItem> = {};
      
      // Parse imeta tag components
      for (let i = 1; i < tag.length; i++) {
        const component = tag[i];
        
        if (component.startsWith('url ')) {
          mediaItem.url = component.substring(4);
        } else if (component.startsWith('m ')) {
          mediaItem.mimeType = component.substring(2);
        } else if (component.startsWith('size ')) {
          mediaItem.size = parseInt(component.substring(5));
        } else if (component.startsWith('x ')) {
          mediaItem.hash = component.substring(2);
        }
      }
      
      if (mediaItem.url && mediaItem.mimeType && isSafeUrl(mediaItem.url)) {
        // Determine media type from MIME type
        if (mediaItem.mimeType.startsWith('image/')) {
          mediaItem.type = 'image';
        } else if (mediaItem.mimeType.startsWith('video/')) {
          mediaItem.type = 'video';
        } else if (mediaItem.mimeType.startsWith('audio/')) {
          mediaItem.type = 'audio';
        }
        
        if (mediaItem.type) {
          media.push(mediaItem as MediaItem);
        }
      }
    }
  }
  
  // Also extract URLs from content that might be media
  const urlRegex = /https?:\/\/[^\s]+/g;
  const contentUrls = event.content.match(urlRegex) || [];
  
  for (const url of contentUrls) {
    // Simple detection based on file extension
    const lowerUrl = url.toLowerCase();
    let type: MediaItem['type'] | null = null;
    
    if (lowerUrl.match(/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/)) {
      type = 'image';
    } else if (lowerUrl.match(/\.(mp4|webm|ogg|avi|mov)(\?.*)?$/)) {
      type = 'video';
    } else if (lowerUrl.match(/\.(mp3|wav|ogg|m4a|flac|aac)(\?.*)?$/)) {
      type = 'audio';
    }
    
    if (type && !media.some(m => m.url === url)) {
      media.push({ url, type });
    }
  }
  
  return media;
}

/**
 * Extract repost information from event
 */
export function extractRepostData(event: NostrEvent): RepostData | null {
  if (event.kind !== 6 && event.kind !== 16) {
    return null;
  }
  
  // Find the 'e' tag that references the original event
  const eTag = event.tags.find(([name]) => name === 'e');
  if (!eTag || !eTag[1]) {
    return null;
  }
  
  // Find the 'p' tag that references the original author
  const pTag = event.tags.find(([name]) => name === 'p');
  
  // For kind 16, also check for 'k' tag that indicates original event kind
  const kTag = event.tags.find(([name]) => name === 'k');
  
  return {
    originalEventId: eTag[1],
    originalAuthorPubkey: pTag?.[1],
    relayUrl: eTag[2],
    kind: kTag ? parseInt(kTag[1]) : undefined,
  };
}

/**
 * Extract embedded Nostr event references from content
 */
export function extractNostrRefs(content: string): Array<{ type: string; data: string; full: string }> {
  const nostrRegex = /nostr:(npub1|note1|nprofile1|nevent1|naddr1)([023456789acdefghjklmnpqrstuvwxyz]+)/g;
  const refs: Array<{ type: string; data: string; full: string }> = [];
  
  let match;
  while ((match = nostrRegex.exec(content)) !== null) {
    refs.push({
      type: match[1],
      data: match[2],
      full: match[0],
    });
  }
  
  return refs;
}

/**
 * Check if URL is a media file based on extension
 */
export function getMediaTypeFromUrl(url: string): MediaItem['type'] | null {
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.match(/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/)) {
    return 'image';
  } else if (lowerUrl.match(/\.(mp4|webm|ogg|avi|mov)(\?.*)?$/)) {
    return 'video';
  } else if (lowerUrl.match(/\.(mp3|wav|ogg|m4a|flac|aac)(\?.*)?$/)) {
    return 'audio';
  }
  
  return null;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}