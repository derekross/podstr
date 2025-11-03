import { nip19 } from 'nostr-tools';

/**
 * Podcast configuration for PODSTR
 * This defines the podcast metadata and creator information
 * Values are loaded from environment variables with fallbacks
 */

/**
 * Safely parse JSON from environment variable
 */
function parseJsonEnv<T>(envValue: string | undefined, fallback: T): T {
  if (!envValue || envValue.trim() === '') return fallback;
  try {
    return JSON.parse(envValue) as T;
  } catch (error) {
    console.warn(`Failed to parse JSON from env var, using fallback:`, error);
    return fallback;
  }
}

/**
 * Parse comma-separated string to array
 */
function parseArrayEnv(envValue: string | undefined, fallback: string[]): string[] {
  if (!envValue || envValue.trim() === '') return fallback;
  return envValue.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

export interface PodcastConfig {
  /** The hardcoded npub of the podcast creator */
  creatorNpub: string;

  /** Podcast metadata */
  podcast: {
    title: string;
    description: string;
    author: string;
    email: string;
    image: string;
    language: string;
    categories: string[];
    explicit: boolean;
    website: string;
    copyright: string;
    funding: string[];
    locked: boolean;
    value: {
      amount: number;
      currency: string;
      recipients?: Array<{
        name: string;
        type: 'node' | 'lnaddress';
        address: string;
        split: number;
        customKey?: string;
        customValue?: string;
        fee?: boolean;
      }>;
    };
    type: 'episodic' | 'serial';
    complete: boolean;
    // New Podcasting 2.0 fields
    guid?: string; // Unique podcast identifier
    medium?: 'podcast' | 'music' | 'video' | 'film' | 'audiobook' | 'newsletter' | 'blog';
    publisher?: string; // Publisher name
    location?: {
      name: string;
      geo?: string; // latitude,longitude
      osm?: string; // OpenStreetMap identifier
    };
    person?: Array<{
      name: string;
      role: string;
      group?: string;
      img?: string;
      href?: string;
    }>;
    license?: {
      identifier: string;
      url?: string;
    };
    txt?: Array<{
      purpose: string;
      content: string;
    }>;
    remoteItem?: Array<{
      feedGuid: string;
      feedUrl?: string;
      itemGuid?: string;
      medium?: string;
    }>;
    block?: {
      id: string;
      reason?: string;
    };
    newFeedUrl?: string;
    useOP3?: boolean;
  };

  /** RSS feed configuration */
  rss: {
    ttl: number; // Cache time in minutes - RSS specific setting
  };
}

export const PODCAST_CONFIG: PodcastConfig = {
  // Creator npub - loaded from environment
  creatorNpub: import.meta.env.VITE_CREATOR_NPUB || "npub1km5prrxcgt5fwgjzjpltyswsuu7u7jcj2cx9hk2rwvxyk00v2jqsgv0a3h",

  podcast: {
    title: import.meta.env.VITE_PODCAST_TITLE || "PODSTR Podcast",
    description: import.meta.env.VITE_PODCAST_DESCRIPTION || "A Nostr-powered podcast exploring decentralized conversations",
    author: import.meta.env.VITE_PODCAST_AUTHOR || "PODSTR Creator",
    email: import.meta.env.VITE_PODCAST_EMAIL || "creator@podstr.example",
    image: import.meta.env.VITE_PODCAST_IMAGE || "https://example.com/podcast-artwork.jpg",
    language: import.meta.env.VITE_PODCAST_LANGUAGE || "en-us",
    categories: parseArrayEnv(import.meta.env.VITE_PODCAST_CATEGORIES, ["Technology", "Social Networking", "Society & Culture"]),
    explicit: import.meta.env.VITE_PODCAST_EXPLICIT === "true",
    website: import.meta.env.VITE_PODCAST_WEBSITE || "https://podstr.example",
    copyright: import.meta.env.VITE_PODCAST_COPYRIGHT || "© 2025 PODSTR Creator",
    funding: parseArrayEnv(import.meta.env.VITE_PODCAST_FUNDING, ["/about"]),
    locked: import.meta.env.VITE_PODCAST_LOCKED === "true",
    value: {
      amount: parseInt(import.meta.env.VITE_PODCAST_VALUE_AMOUNT || "1000", 10),
      currency: import.meta.env.VITE_PODCAST_VALUE_CURRENCY || "sats",
      recipients: parseJsonEnv(import.meta.env.VITE_PODCAST_VALUE_RECIPIENTS, [
        {
          name: "Podcast Host",
          type: "node" as const,
          address: "030a58b8653d32b99200a2334cfe913e51dc7d155aa0116c176657a4f1722677a3",
          split: 80,
          fee: false
        },
        {
          name: "Producer",
          type: "lnaddress" as const, 
          address: "producer@getalby.com",
          split: 15,
          customKey: "podcast",
          customValue: "producer-fee"
        },
        {
          name: "Platform Fee",
          type: "node" as const,
          address: "021f2f8e1e46a48d0a9f1b7e4e8b5c8d5e4f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6",
          split: 5,
          fee: true
        }
      ])
    },
    type: (import.meta.env.VITE_PODCAST_TYPE as "episodic" | "serial") || "episodic",
    complete: import.meta.env.VITE_PODCAST_COMPLETE === "true",
    // Podcasting 2.0 fields from environment
    guid: import.meta.env.VITE_PODCAST_GUID || import.meta.env.VITE_CREATOR_NPUB || "npub1km5prrxcgt5fwgjzjpltyswsuu7u7jcj2cx9hk2rwvxyk00v2jqsgv0a3h",
    medium: (import.meta.env.VITE_PODCAST_MEDIUM as "podcast" | "music" | "video" | "film" | "audiobook" | "newsletter" | "blog") || "podcast",
    publisher: import.meta.env.VITE_PODCAST_PUBLISHER || import.meta.env.VITE_PODCAST_AUTHOR || "PODSTR Creator",
    location: import.meta.env.VITE_PODCAST_LOCATION_NAME ? {
      name: import.meta.env.VITE_PODCAST_LOCATION_NAME,
      geo: import.meta.env.VITE_PODCAST_LOCATION_GEO || undefined,
      osm: import.meta.env.VITE_PODCAST_LOCATION_OSM || undefined
    } : undefined,
    person: parseJsonEnv(import.meta.env.VITE_PODCAST_PERSON, [
      {
        name: import.meta.env.VITE_PODCAST_AUTHOR || "PODSTR Creator",
        role: "host",
        group: "cast"
      }
    ]),
    license: {
      identifier: import.meta.env.VITE_PODCAST_LICENSE_IDENTIFIER || "CC BY 4.0",
      url: import.meta.env.VITE_PODCAST_LICENSE_URL || "https://creativecommons.org/licenses/by/4.0/"
    },
    txt: parseJsonEnv(import.meta.env.VITE_PODCAST_TXT, undefined),
    remoteItem: parseJsonEnv(import.meta.env.VITE_PODCAST_REMOTE_ITEM, undefined),
    block: parseJsonEnv(import.meta.env.VITE_PODCAST_BLOCK, undefined),
    newFeedUrl: import.meta.env.VITE_PODCAST_NEW_FEED_URL || undefined,
    useOP3: import.meta.env.VITE_PODCAST_USE_OP3 === "true"
  },

  rss: {
    ttl: parseInt(import.meta.env.VITE_RSS_TTL || "60", 10)
  }
};

/**
 * Nostr event kinds used by PODSTR
 */
export const PODCAST_KINDS = {
  /** Addressable Podcast episodes (editable, replaceable) */
  EPISODE: 30054,
  /** Addressable Podcast trailers (editable, replaceable) */
  TRAILER: 30055,
  /** NIP-22: Comments on podcast episodes */
  COMMENT: 1111,
  /** Standard text notes that may reference episodes */
  NOTE: 1,
  /** Profile metadata */
  PROFILE: 0,
  /** Podcast metadata - using addressable event for podcast-specific config */
  PODCAST_METADATA: 30078
} as const;

/**
 * Get the creator's pubkey in hex format (for Nostr queries)
 */
export function getCreatorPubkeyHex(): string {
  try {
    const decoded = nip19.decode(PODCAST_CONFIG.creatorNpub);
    if (decoded.type === 'npub') {
      return decoded.data;
    }
    throw new Error('Invalid npub format');
  } catch (error) {
    console.error('Failed to decode creator npub:', error);
    // Fallback to the original value in case it's already hex
    return PODCAST_CONFIG.creatorNpub;
  }
}

/**
 * Check if a pubkey is the podcast creator
 */
export function isPodcastCreator(pubkey: string): boolean {
  const creatorHex = getCreatorPubkeyHex();
  return pubkey === creatorHex;
}
