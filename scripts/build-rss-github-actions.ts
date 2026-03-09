import { promises as fs } from 'fs';
import path from 'path';
import { nip19 } from 'nostr-tools';
import { NRelay1, NostrEvent } from '@nostrify/nostrify';
import type { PodcastEpisode, PodcastTrailer } from '../src/types/podcast.js';
import { PODCAST_CONFIG } from '../src/lib/podcastConfig.js';

// Import naddr encoding function
import { encodeEpisodeAsNaddr } from '../src/lib/nip19Utils.js';
// Import OP3 utilities
import { addOP3Prefix } from '../src/lib/op3Utils.js';

// Podcast kinds used by PODSTR
const PODCAST_KINDS = {
  EPISODE: 30054, // Addressable Podcast episodes (editable, replaceable)
  TRAILER: 30055, // Addressable Podcast trailers (editable, replaceable)
  PODCAST_METADATA: 30078, // Podcast metadata (addressable event)
} as const;

/**
 * Node-specific function to get creator pubkey in hex format
 */
function getCreatorPubkeyHex(creatorNpub: string): string {
  try {
    const decoded = nip19.decode(creatorNpub);
    if (decoded.type === 'npub') {
      return decoded.data;
    }
    throw new Error('Invalid npub format');
  } catch (error) {
    console.error('Failed to decode creator npub:', error);
    // Fallback to the original value in case it's already hex
    return creatorNpub;
  }
}

/**
 * Fetch podcast metadata from multiple relays
 */
async function fetchPodcastMetadataMultiRelay(relays: Array<{url: string, relay: NRelay1}>, creatorPubkeyHex: string) {
  console.log('📡 Fetching podcast metadata from Nostr...');

  for (const { url, relay } of relays) {
    try {
      console.log(`🔄 Trying relay: ${url}`);
      const events = await relay.query([{
        kinds: [PODCAST_KINDS.PODCAST_METADATA],
        authors: [creatorPubkeyHex],
        limit: 1
      }]);

      if (events.length > 0) {
        const event = events[0];
        console.log('✅ Found podcast metadata on:', url);

        const metadata: Record<string, string> = {};
        for (const [tagName, value] of event.tags) {
          metadata[tagName] = value;
        }

        return metadata;
      }
    } catch (error) {
      console.warn(`⚠️  Failed to fetch from ${url}:`, error);
    }
  }

  console.log('📄 No podcast metadata found on any relay');
  return null;
}

/**
 * Fetch podcast episodes from multiple relays
 */
async function fetchPodcastEpisodesMultiRelay(relays: Array<{url: string, relay: NRelay1}>, creatorPubkeyHex: string) {
  console.log('📡 Fetching podcast episodes from Nostr...');

  const episodeMap = new Map<string, NostrEvent>();

  for (const { url, relay } of relays) {
    try {
      console.log(`🔄 Trying episodes on relay: ${url}`);
      const events = await relay.query([{
        kinds: [PODCAST_KINDS.EPISODE],
        authors: [creatorPubkeyHex],
        limit: 100
      }]);

      console.log(`📊 Found ${events.length} episodes on ${url}`);

      for (const event of events) {
        const d = event.tags.find(([name]) => name === 'd')?.[1];
        if (d) {
          // Keep the event with the most recent timestamp
          const existing = episodeMap.get(d);
          if (!existing || event.created_at > existing.created_at) {
            episodeMap.set(d, event);
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️  Failed to fetch episodes from ${url}:`, error);
    }
  }

  const episodes = Array.from(episodeMap.values());
  console.log(`✅ Total unique episodes found: ${episodes.length}`);
  return episodes;
}

/**
 * Fetch podcast trailers from multiple relays
 */
async function fetchPodcastTrailersMultiRelay(relays: Array<{url: string, relay: NRelay1}>, creatorPubkeyHex: string) {
  console.log('📡 Fetching podcast trailers from Nostr...');

  const trailerMap = new Map<string, NostrEvent>();

  for (const { url, relay } of relays) {
    try {
      console.log(`🔄 Trying trailers on relay: ${url}`);
      const events = await relay.query([{
        kinds: [PODCAST_KINDS.TRAILER],
        authors: [creatorPubkeyHex],
        limit: 100
      }]);

      console.log(`📊 Found ${events.length} trailers on ${url}`);

      for (const event of events) {
        const d = event.tags.find(([name]) => name === 'd')?.[1];
        if (d) {
          const existing = trailerMap.get(d);
          if (!existing || event.created_at > existing.created_at) {
            trailerMap.set(d, event);
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️  Failed to fetch trailers from ${url}:`, error);
    }
  }

  const trailers = Array.from(trailerMap.values());
  console.log(`✅ Total unique trailers found: ${trailers.length}`);
  return trailers;
}

/**
 * Parse episode from Nostr event
 */
function parseEpisodeFromEvent(event: NostrEvent): PodcastEpisode | null {
  try {
    const d = event.tags.find(([name]) => name === 'd')?.[1];
    const title = event.tags.find(([name]) => name === 'title')?.[1];
    const description = event.tags.find(([name]) => name === 'description' || name === 'summary')?.[1];
    const image = event.tags.find(([name]) => name === 'image' || name === 'cover')?.[1];
    const url = event.tags.find(([name]) => name === 'url' || name === 'audio' || name === ' enclosure')?.[1];
    const duration = event.tags.find(([name]) => name === 'duration')?.[1];
    const episodeNumber = event.tags.find(([name]) => name === 'episode' || name === 'number')?.[1];
    const explicit = event.tags.find(([name]) => name === 'explicit')?.[1];
    const type = event.tags.find(([name]) => name === 'type')?.[1];
    const season = event.tags.find(([name]) => name === 'season')?.[1];
    const size = event.tags.find(([name]) => name === 'size')?.[1];

    if (!d || !title || !url) {
      console.warn('⚠️  Invalid episode event - missing required fields:', { d, title, url });
      return null;
    }

    return {
      identifier: d,
      title,
      description: description || event.content || '',
      image,
      url,
      duration: duration ? parseInt(duration) : undefined,
      episodeNumber: episodeNumber ? parseInt(episodeNumber) : undefined,
      explicit: explicit === 'true' || explicit === 'yes',
      type: (type as 'full' | 'trailer' | undefined) || undefined,
      season: season ? parseInt(season) : undefined,
      size: size ? parseInt(size) : undefined,
      pubDate: new Date(event.created_at * 1000).toISOString(),
      createdAt: new Date(event.created_at * 1000).toISOString(),
      author: event.pubkey,
    };
  } catch (error) {
    console.error('❌ Error parsing episode:', error);
    return null;
  }
}

/**
 * Parse trailer from Nostr event
 */
function parseTrailerFromEvent(event: NostrEvent): PodcastTrailer | null {
  try {
    const d = event.tags.find(([name]) => name === 'd')?.[1];
    const title = event.tags.find(([name]) => name === 'title')?.[1];
    const description = event.tags.find(([name]) => name === 'description' || name === 'summary')?.[1];
    const image = event.tags.find(([name]) => name === 'image' || name === 'cover')?.[1];
    const url = event.tags.find(([name]) => name === 'url' || name === 'video')?.[1];
    const duration = event.tags.find(([name]) => name === 'duration')?.[1];
    const episodeNumber = event.tags.find(([name]) => name === 'episode' || name === 'number')?.[1];
    const explicit = event.tags.find(([name]) => name === 'explicit')?.[1];
    const type = event.tags.find(([name]) => name === 'type')?.[1];
    const season = event.tags.find(([name]) => name === 'season')?.[1];

    if (!d || !title || !url) {
      console.warn('⚠️  Invalid trailer event - missing required fields:', { d, title, url });
      return null;
    }

    return {
      identifier: d,
      title,
      description: description || event.content || '',
      image,
      url,
      duration: duration ? parseInt(duration) : undefined,
      episodeNumber: episodeNumber ? parseInt(episodeNumber) : undefined,
      explicit: explicit === 'true' || explicit === 'yes',
      type: (type as 'full' | 'trailer' | undefined) || undefined,
      season: season ? parseInt(season) : undefined,
      pubDate: new Date(event.created_at * 1000).toISOString(),
      createdAt: new Date(event.created_at * 1000).toISOString(),
      author: event.pubkey,
    };
  } catch (error) {
    console.error('❌ Error parsing trailer:', error);
    return null;
  }
}

/**
 * Build RSS feed for GitHub Actions
 */
async function buildRSSForGitHubActions() {
  console.log('🏗️  Building RSS feed for GitHub Actions...');

  // Use imported config directly
  const baseConfig = PODCAST_CONFIG;
  const creatorPubkeyHex = getCreatorPubkeyHex(baseConfig.creatorNpub);

  console.log(`👤 Creator: ${baseConfig.creatorNpub}`);

  // Connect to multiple Nostr relays for better coverage
  const relayUrls = [
    'wss://relay.primal.net',
    'wss://relay.nostr.band',
    'wss://relay.damus.io',
    'wss://nos.lol',
    'wss://relay.ditto.pub'
  ];

  console.log(`🔌 Connecting to ${relayUrls.length} relays for better data coverage`);
  const relays = relayUrls.map(url => ({ url, relay: new NRelay1(url) }));

  let finalConfig: typeof PODCAST_CONFIG = baseConfig;
  let episodes: PodcastEpisode[] = [];
  let trailers: PodcastTrailer[] = [];
  let nostrMetadata: Record<string, string> | null = null;

  try {
    // Fetch podcast metadata from multiple relays
    nostrMetadata = await fetchPodcastMetadataMultiRelay(relays, creatorPubkeyHex);

    // Merge Nostr metadata with base config (Nostr data takes precedence)
    if (nostrMetadata) {
      finalConfig = {
        ...baseConfig,
        podcast: {
          ...baseConfig.podcast,
          ...nostrMetadata
        }
      };
      console.log('🎯 Using podcast metadata from Nostr');
    } else {
      console.log('📄 Using podcast metadata from config file');
    }

    // Fetch episodes from multiple relays
    const episodeEvents = await fetchPodcastEpisodesMultiRelay(relays, creatorPubkeyHex);
    episodes = episodeEvents
      .map(parseEpisodeFromEvent)
      .filter((episode): episode is PodcastEpisode => episode !== null);

    // Fetch trailers from multiple relays
    const trailerEvents = await fetchPodcastTrailersMultiRelay(relays, creatorPubkeyHex);
    trailers = trailerEvents
      .map(parseTrailerFromEvent)
      .filter((trailer): trailer is PodcastTrailer => trailer !== null);

  } finally {
    // Close all relay connections
    for (const { url, relay } of relays) {
      try {
        relay.close();
      } catch (error) {
        console.warn(`⚠️  Failed to close relay ${url}:`, error);
      }
    }
    console.log('🔌 Relay queries completed');
  }

  console.log(`📊 Generating RSS with ${episodes.length} episodes and ${trailers.length} trailers`);
  console.log(`🔍 OP3 Analytics: ${finalConfig.podcast.useOP3 ? 'ENABLED' : 'DISABLED'}`);

  // Generate RSS feed with fetched data
  const rssContent = generateRSSFeed(episodes, trailers, finalConfig);

  // Ensure dist directory exists
  const distDir = path.resolve('dist');
  await fs.mkdir(distDir, { recursive: true });

  // Write RSS file
  const rssPath = path.join(distDir, 'rss.xml');
  await fs.writeFile(rssPath, rssContent, 'utf-8');

  console.log(`✅ RSS feed generated successfully at: ${rssPath}`);
  console.log(`📊 Feed size: ${(rssContent.length / 1024).toFixed(2)} KB`);

  // Write a health check file
  const healthPath = path.join(distDir, 'rss-health.json');
  const healthData = {
    status: 'ok',
    endpoint: '/rss.xml',
    generatedAt: new Date().toISOString(),
    episodeCount: episodes.length,
    trailerCount: trailers.length,
    feedSize: rssContent.length,
    environment: 'production',
    accessible: true,
    dataSource: {
      metadata: nostrMetadata ? 'nostr' : 'config',
      episodes: episodes.length > 0 ? 'nostr' : 'none',
      trailers: trailers.length > 0 ? 'nostr' : 'none',
      relays: relayUrls
    },
    creator: baseConfig.creatorNpub
  };
  await fs.writeFile(healthPath, JSON.stringify(healthData, null, 2));

  console.log(`✅ Health check file generated at: ${healthPath}`);
}

/**
 * Generate RSS feed XML
 */
function generateRSSFeed(episodes: PodcastEpisode[], trailers: PodcastTrailer[], config: typeof PODCAST_CONFIG): string {
  const baseUrl = config.podcast.website || 'https://kurt-croix.github.io/podstr';
  const useOP3 = config.podcast.useOP3 || false;

  // Escape XML special characters
  const escapeXml = (unsafe: string) => {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  // Format duration in seconds to HH:MM:SS format
  const formatDuration = (seconds: number) => {
    if (!seconds) return '00:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Generate episode item XML
  const generateItemXML = (episode: PodcastEpisode | PodcastTrailer, isTrailer: boolean = false) => {
    const audioUrl = episode.url;
    const pubDate = episode.pubDate || new Date(episode.createdAt || Date.now()).toISOString();
    const duration = episode.duration ? formatDuration(episode.duration) : '00:00';
    const imageUrl = episode.image || config.podcast.image;

    return `
    <item>
      <title>${escapeXml(episode.title)}</title>
      <description>${escapeXml(episode.description || '')}</description>
      <link>${escapeXml(audioUrl)}</link>
      <guid isPermaLink="false">${escapeXml(episode.identifier || audioUrl)}</guid>
      <pubDate>${escapeXml(pubDate)}</pubDate>
      <enclosure url="${escapeXml(audioUrl)}" type="${isTrailer ? 'video/mp4' : 'audio/mpeg'}" length="${episode.size || 0}" />
      <itunes:author>${escapeXml(config.podcast.author)}</itunes:author>
      <itunes:subtitle>${escapeXml(episode.description || '').split('\n')[0]}</itunes:subtitle>
      <itunes:summary>${escapeXml(episode.description || '')}</itunes:summary>
      <itunes:image href="${escapeXml(imageUrl)}" />
      <itunes:duration>${duration}</itunes:duration>
      <itunes:explicit>${episode.explicit || config.podcast.explicit ? 'yes' : 'no'}</itunes:explicit>
      <itunes:episodeType>${episode.type || config.podcast.type}</itunes:episodeType>
      ${episode.episodeNumber ? `<itunes:episode>${episode.episodeNumber}</itunes:episode>` : ''}
      ${episode.season ? `<itunes:season>${episode.season}</itunes:season>` : ''}
      ${useOP3 ? `<podcast:alternateEnclosure type="video/mp4" url="${escapeXml(audioUrl + '?op3')}"/>` : ''}
      <category>${escapeXml(config.podcast.categories[0] || 'Technology')}</category>
    </item>`;
  };

  // Sort items by pubDate (newest first)
  const sortedEpisodes = episodes.sort((a, b) =>
    new Date(b.pubDate || b.createdAt).getTime() - new Date(a.pubDate || a.createdAt).getTime()
  );
  const sortedTrailers = trailers.sort((a, b) =>
    new Date(b.pubDate || b.createdAt).getTime() - new Date(a.pubDate || a.createdAt).getTime()
  );

  // Combine trailers and episodes
  const allItems = [
    ...sortedTrailers.map(t => generateItemXML(t, true)),
    ...sortedEpisodes.map(e => generateItemXML(e, false))
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:podcast="https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md">
  <channel>
    <title>${escapeXml(config.podcast.title)}</title>
    <description>${escapeXml(config.podcast.description)}</description>
    <link>${escapeXml(baseUrl)}</link>
    <language>${escapeXml(config.podcast.language)}</language>
    <copyright>${escapeXml(config.podcast.copyright)}</copyright>
    <managingEditor>${escapeXml(config.podcast.email)} (${escapeXml(config.podcast.author)})</managingEditor>
    <webMaster>${escapeXml(config.podcast.email)} (${escapeXml(config.podcast.author)})</webMaster>
    <pubDate>${new Date().toUTCString()}</pubDate>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <ttl>${config.rss.ttl}</ttl>

    <!-- iTunes/Apple Podcasts tags -->
    <itunes:title>${escapeXml(config.podcast.title)}</itunes:title>
    <itunes:summary>${escapeXml(config.podcast.description)}</itunes:summary>
    <itunes:author>${escapeXml(config.podcast.author)}</itunes:author>
    <itunes:owner>
      <itunes:name>${escapeXml(config.podcast.author)}</itunes:name>
      <itunes:email>${escapeXml(config.podcast.email)}</itunes:email>
    </itunes:owner>
    <itunes:image href="${escapeXml(config.podcast.image)}" />
    <itunes:category text="${escapeXml(config.podcast.categories[0] || 'Technology')}" />
    <itunes:explicit>${config.podcast.explicit ? 'yes' : 'no'}</itunes:explicit>
    <itunes:type>${escapeXml(config.podcast.type)}</itunes:type>

    <!-- Podcasting 2.0 tags -->
    <podcast:guid>${escapeXml(config.podcast.guid)}</podcast:guid>
    <podcast:medium>${escapeXml(config.podcast.medium)}</podcast:medium>
    <podcast:value type="lightning" method="${escapeXml(config.podcast.value.currency)}">${config.podcast.value.amount}</podcast:value>
    ${config.podcast.value.recipients.map(rec => `
    <podcast:valueRecipient type="${escapeXml(rec.type)}">${escapeXml(rec.address)}</podcast:valueRecipient>
    <podcast:valueRecipient name="${escapeXml(rec.name)}" split="${rec.split}"${rec.fee ? ' fee="true"' : ''} />
    `).join('')}

    <!-- Person tags -->
    ${config.podcast.person.map(p => `
    <podcast:person role="${escapeXml(p.role)}" group="${escapeXml(p.group)}">${escapeXml(p.name)}</podcast:person>
    `).join('')}

    <!-- License -->
    <podcast:license>${escapeXml(config.podcast.license.identifier)}${config.podcast.license.url ? ` url="${escapeXml(config.podcast.license.url)}"` : ''}</podcast:license>

    <!-- Episodes and Trailers -->
    ${allItems.join('')}

  </channel>
</rss>`;
}

// Build RSS feed
buildRSSForGitHubActions().catch(error => {
  console.error('❌ Error building RSS feed:', error);
  process.exit(1);
});
