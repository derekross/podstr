import { nip19 } from 'nostr-tools';

/**
 * Podcast configuration for PODSTR 2.0
 * 
 * Edit this file directly to configure your podcast.
 * All values are hardcoded - no environment variables needed!
 * 
 * TIP: Use Shakespeare.diy (https://shakespeare.diy) to easily configure
 * these settings with AI assistance. See README.md for the configuration prompt.
 */

export interface PodcastConfig {
  /** The npub of the podcast creator */
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
      recipients: Array<{
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
    // Podcasting 2.0 fields
    guid: string;
    medium: 'podcast' | 'music' | 'video' | 'film' | 'audiobook' | 'newsletter' | 'blog';
    publisher: string;
    location?: {
      name: string;
      geo?: string;
      osm?: string;
    };
    person: Array<{
      name: string;
      role: string;
      group?: string;
      img?: string;
      href?: string;
    }>;
    license: {
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
    useOP3: boolean;
  };

  /** RSS feed configuration */
  rss: {
    ttl: number;
  };
}

// =============================================================================
// PODCAST CONFIGURATION
// =============================================================================
// Edit the values below to configure your podcast.
// Use Shakespeare.diy for AI-assisted configuration - see README.md
// =============================================================================

export const PODCAST_CONFIG: PodcastConfig = {
  // ===========================================================================
  // CREATOR IDENTITY
  // ===========================================================================
  // Your Nostr public key in npub format
  creatorNpub: "npub17w98lrsg36nj0cckhxgd52wdlrgnx544lgy4jsg3fwpla7jtvlaqgjdrc6",

  podcast: {
    // =========================================================================
    // BASIC PODCAST INFO
    // =========================================================================

    // The name of your podcast
    title: "Croix4Clerk",

    // A description of your podcast content
    description: "A podcast for Kurt Croix's run for Clerk in Ray County, MO in 2026.",

    // Your name as the podcast author/host
    author: "Kurt Croix",

    // Contact email for your podcast
    email: "croix4clerk@pm.me",

    // URL to your podcast cover art image (minimum 1400x1400 pixels recommended)
    image: "https://pbcdn1.podbean.com/imglogo/image-logo/22151441/podcastLogo_9udnn9_300x300.png",

    // Language code (e.g., en-us, es-es, fr-fr)
    language: "en-us",

    // Podcast categories
    categories: ["Government"],

    // Whether your podcast contains explicit content
    explicit: false,

    // Your podcast website URL
    website: "https://mypodcast.com",

    // Copyright notice
    copyright: "@2026 Kurt Croix",

    // =========================================================================
    // PODCASTING 2.0 SETTINGS
    // =========================================================================

    // Unique identifier for your podcast (typically your npub)
    guid: "npub17w98lrsg36nj0cckhxgd52wdlrgnx544lgy4jsg3fwpla7jtvlaqgjdrc6",

    // Type of podcast content
    medium: "podcast",

    // Publisher name (can be same as author)
    publisher: "Kurt Croix",

    // Podcast type: "episodic" (standalone episodes) or "serial" (sequential)
    type: "episodic",

    // Whether the podcast is complete/finished
    complete: false,

    // Whether the podcast is locked/premium
    locked: false,

    // =========================================================================
    // LOCATION (Optional)
    // =========================================================================
    // Uncomment and edit to set recording location
    // location: {
    //   name: "City, Country",
    //   geo: "latitude,longitude",
    //   osm: "OpenStreetMap ID",
    // },

    // =========================================================================
    // LICENSE
    // =========================================================================
    license: {
      identifier: "CC BY 4.0",
      url: "https://creativecommons.org/licenses/by/4.0/",
    },

    // =========================================================================
    // LIGHTNING VALUE-FOR-VALUE
    // =========================================================================
    value: {
      // Suggested amount per minute in sats
      amount: 0,

      // Currency type
      currency: "sats",

      // Payment recipients - splits must add up to 100
      recipients: [
        {
          name: "Kurt Croix",
          type: "lnaddress",
          address: "croix4clerk@pm.me",
          split: 100,
          fee: false,
        },
      ],
    },

    // =========================================================================
    // FUNDING LINKS (Optional)
    // =========================================================================
    // URLs for donation/funding pages
    funding: ["/about"],

    // =========================================================================
    // PODCAST PEOPLE
    // =========================================================================
    // People involved in the podcast
    person: [
      {
        name: "Kurt Croix",
        role: "host",
        group: "cast",
        // img: "https://your-photo-url.jpg",
        // href: "https://your-website.com",
      },
    ],

    // =========================================================================
    // ANALYTICS
    // =========================================================================
    // Enable OP3.dev analytics (requires VITE_OP3_API_TOKEN env var)
    useOP3: false,

    // =========================================================================
    // ADVANCED SETTINGS (Optional)
    // =========================================================================
    // Uncomment and configure as needed:

    // Text metadata
    // txt: [
    //   { purpose: "verify", content: "verification_text" },
    // ],

    // Remote item references
    // remoteItem: [
    //   { feedGuid: "guid", feedUrl: "url", itemGuid: "guid", medium: "podcast" },
    // ],

    // Content blocking
    // block: {
    //   id: "platform_id",
    //   reason: "reason_text",
    // },

    // New feed URL (for podcast migration)
    // newFeedUrl: "https://new-feed-url.com/rss.xml",
  },

  // ===========================================================================
  // RSS FEED SETTINGS
  // ===========================================================================
  rss: {
    // Cache time in minutes
    ttl: 60,
  },
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
