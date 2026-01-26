import { promises as fs } from 'fs';
import path from 'path';
import { nip19 } from 'nostr-tools';
import { NRelay1, NostrEvent } from '@nostrify/nostrify';
import type { PodcastEpisode, PodcastTrailer } from '../src/types/podcast.js';
import { PODCAST_CONFIG, PodcastConfig } from '../src/lib/podcastConfig.js';

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
 * Escape XML special characters
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Format duration in seconds to HH:MM:SS format for iTunes RSS
 */
function formatDurationForRSS(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

/**
 * Node-compatible RSS feed generation
 */
function generateRSSFeed(episodes: PodcastEpisode[], trailers: PodcastTrailer[], podcastConfig: PodcastConfig): string {
  const baseUrl = podcastConfig.podcast.website || 'https://podstr.example';
  const useOP3 = podcastConfig.podcast.useOP3 || false;

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:podcast="https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md">
  <channel>
    <title>${escapeXml(podcastConfig.podcast.title)}</title>
    <description>${escapeXml(podcastConfig.podcast.description)}</description>
    <link>${escapeXml(podcastConfig.podcast.website || baseUrl)}</link>
    <language>${escapeXml(podcastConfig.podcast.language)}</language>
    <copyright>${escapeXml(podcastConfig.podcast.copyright)}</copyright>
    <managingEditor>${escapeXml(podcastConfig.podcast.email)} (${escapeXml(podcastConfig.podcast.author)})</managingEditor>
    <webMaster>${escapeXml(podcastConfig.podcast.email)} (${escapeXml(podcastConfig.podcast.author)})</webMaster>
    <pubDate>${new Date().toUTCString()}</pubDate>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <ttl>${podcastConfig.rss.ttl}</ttl>

    <!-- iTunes/Apple Podcasts tags -->
    <itunes:title>${escapeXml(podcastConfig.podcast.title)}</itunes:title>
    <itunes:summary>${escapeXml(podcastConfig.podcast.description)}</itunes:summary>
    <itunes:author>${escapeXml(podcastConfig.podcast.author)}</itunes:author>
    <itunes:owner>
      <itunes:name>${escapeXml(podcastConfig.podcast.author)}</itunes:name>
      <itunes:email>${escapeXml(podcastConfig.podcast.email)}</itunes:email>
    </itunes:owner>
    <itunes:image href="${escapeXml(podcastConfig.podcast.image)}" />
    <itunes:category text="${escapeXml(podcastConfig.podcast.categories[0] || 'Technology')}" />
    <itunes:explicit>${podcastConfig.podcast.explicit ? 'yes' : 'no'}</itunes:explicit>
    <itunes:type>${escapeXml(podcastConfig.podcast.type)}</itunes:type>

    <!-- Podcasting 2.0 tags -->
    <podcast:guid>${escapeXml(podcastConfig.podcast.guid || podcastConfig.creatorNpub)}</podcast:guid>
    <podcast:medium>${escapeXml(podcastConfig.podcast.medium || 'podcast')}</podcast:medium>
    <podcast:locked>${podcastConfig.podcast.locked ? 'yes' : 'no'}</podcast:locked>

    ${podcastConfig.podcast.funding && podcastConfig.podcast.funding.length > 0 ?
      podcastConfig.podcast.funding.map(url =>
        `<podcast:funding url="${escapeXml(url)}">Support the show</podcast:funding>`
      ).join('\n    ') : ''
    }

    ${podcastConfig.podcast.value && podcastConfig.podcast.value.amount > 0 ?
      `<podcast:value type="lightning" method="lnaddress">
        ${podcastConfig.podcast.value.recipients && podcastConfig.podcast.value.recipients.length > 0 ?
          podcastConfig.podcast.value.recipients.map(recipient =>
            `<podcast:valueRecipient name="${escapeXml(recipient.name)}" type="${escapeXml(recipient.type)}" address="${escapeXml(recipient.address)}" split="${recipient.split}"${recipient.customKey ? ` customKey="${escapeXml(recipient.customKey)}"` : ''}${recipient.customValue ? ` customValue="${escapeXml(recipient.customValue)}"` : ''}${recipient.fee ? ` fee="true"` : ''} />`
          ).join('\n        ') :
          `<podcast:valueRecipient name="${escapeXml(podcastConfig.podcast.author)}" type="lnaddress" address="${escapeXml(podcastConfig.podcast.funding?.[0] || '')}" split="100" />`
        }
      </podcast:value>` : ''
    }

    ${trailers.map(trailer => 
      `<podcast:trailer pubdate="${trailer.pubDate.toUTCString()}" url="${escapeXml(trailer.url)}"${trailer.length ? ` length="${trailer.length}"` : ''}${trailer.type ? ` type="${escapeXml(trailer.type)}"` : ''}${trailer.season ? ` season="${trailer.season}"` : ''}>${escapeXml(trailer.title)}</podcast:trailer>`
    ).join('\n    ')}

    ${episodes.map(episode => {
      // Apply OP3 prefix to URLs if enabled
      const audioUrl = useOP3 ? addOP3Prefix(episode.audioUrl) : episode.audioUrl;
      const videoUrl = episode.videoUrl && useOP3 ? addOP3Prefix(episode.videoUrl) : episode.videoUrl;
      const transcriptUrl = episode.transcriptUrl && useOP3 ? addOP3Prefix(episode.transcriptUrl) : episode.transcriptUrl;
      const chaptersUrl = episode.chaptersUrl && useOP3 ? addOP3Prefix(episode.chaptersUrl) : episode.chaptersUrl;

      return `
    <item>
      <title>${escapeXml(episode.title)}</title>
      <description>${escapeXml(episode.description || '')}</description>
      <link>${escapeXml(baseUrl)}/${encodeEpisodeAsNaddr(episode.authorPubkey, episode.identifier)}</link>
      <pubDate>${episode.publishDate.toUTCString()}</pubDate>
      <guid isPermaLink="false">${episode.authorPubkey}:${episode.identifier}</guid>
      <enclosure url="${escapeXml(audioUrl)}" type="${episode.audioType}" length="0" />
      ${videoUrl ? `<enclosure url="${escapeXml(videoUrl)}" type="${episode.videoType || 'video/mp4'}" length="0" />` : ''}
      <itunes:duration>${episode.duration ? formatDurationForRSS(episode.duration) : '00:00'}</itunes:duration>
      <itunes:explicit>${episode.explicit ? 'yes' : 'no'}</itunes:explicit>
      ${episode.imageUrl ? `<itunes:image href="${escapeXml(episode.imageUrl)}" />` : ''}
      ${transcriptUrl ? `<podcast:transcript url="${escapeXml(transcriptUrl)}" type="text/plain" />` : ''}
      ${chaptersUrl ? `<podcast:chapters url="${escapeXml(chaptersUrl)}" type="application/json+chapters" />` : ''}
      ${episode.content ? `<content:encoded><![CDATA[${episode.content}]]></content:encoded>` : ''}
      ${episode.value && episode.value.enabled && episode.value.recipients && episode.value.recipients.length > 0 ?
        `<podcast:value type="${episode.value.currency || 'lightning'}" method="lightning">
        ${episode.value.recipients.map(recipient =>
          `<podcast:valueRecipient name="${escapeXml(recipient.name)}" type="${escapeXml(recipient.type)}" address="${escapeXml(recipient.address)}" split="${recipient.split}"${recipient.customKey ? ` customKey="${escapeXml(recipient.customKey)}"` : ''}${recipient.customValue ? ` customValue="${escapeXml(recipient.customValue)}"` : ''}${recipient.fee ? ` fee="true"` : ''} />`
        ).join('\n        ')}
      </podcast:value>` : ''}
    </item>`;
    }).join('')}
  </channel>
</rss>`;
}

/**
 * Validates if a Nostr event is a valid podcast episode
 */
function validatePodcastEpisode(event: NostrEvent, creatorPubkeyHex: string): boolean {
  if (event.kind !== PODCAST_KINDS.EPISODE) return false;

  // Check for required title tag
  const title = event.tags.find(([name]) => name === 'title')?.[1];
  if (!title) return false;

  // Check for required audio tag
  const audio = event.tags.find(([name]) => name === 'audio')?.[1];
  if (!audio) return false;

  // Verify it's from the podcast creator
  if (event.pubkey !== creatorPubkeyHex) return false;

  return true;
}

/**
 * Converts a validated Nostr event to a PodcastEpisode object
 */
function eventToPodcastEpisode(event: NostrEvent): PodcastEpisode {
  const tags = new Map(event.tags.map(([key, ...values]) => [key, values]));

  const title = tags.get('title')?.[0] || 'Untitled Episode';
  const description = tags.get('description')?.[0];
  const imageUrl = tags.get('image')?.[0];

  // Extract audio URL and type from audio tag
  const audioTag = tags.get('audio');
  const audioUrl = audioTag?.[0] || '';
  const audioType = audioTag?.[1] || 'audio/mpeg';

  // Extract video URL and type from video tag
  const videoTag = tags.get('video');
  const videoUrl = videoTag?.[0];
  const videoType = videoTag?.[1] || 'video/mp4';

  // Extract all 't' tags for topics
  const topicTags = event.tags
    .filter(([name]) => name === 't')
    .map(([, value]) => value);

  // Extract identifier from 'd' tag (for addressable events)
  const identifier = tags.get('d')?.[0] || event.id; // Fallback to event ID for backward compatibility

  // Extract duration from tag
  const durationStr = tags.get('duration')?.[0];
  const duration = durationStr ? parseInt(durationStr, 10) : undefined;

  // Extract publication date from pubdate tag with fallback to created_at
  const pubdateStr = tags.get('pubdate')?.[0];
  let publishDate: Date;
  try {
    publishDate = pubdateStr ? new Date(pubdateStr) : new Date(event.created_at * 1000);
  } catch {
    publishDate = new Date(event.created_at * 1000);
  }

  // Extract transcript URL from tag
  const transcriptUrl = tags.get('transcript')?.[0];

  // Extract chapters URL from tag
  const chaptersUrl = tags.get('chapters')?.[0];

  // Content is just the show notes (plain text)
  const content = event.content || undefined;

  // Parse per-episode value splits
  const valueTagValue = tags.get('value')?.[0];
  let value = undefined;
  if (valueTagValue) {
    try {
      value = JSON.parse(valueTagValue);
    } catch {
      console.warn('Failed to parse episode value tag:', valueTagValue);
    }
  }

  // Parse episode and season numbers
  const episodeNumberStr = tags.get('episode')?.[0];
  const episodeNumber = episodeNumberStr ? parseInt(episodeNumberStr, 10) : undefined;
  
  const seasonNumberStr = tags.get('season')?.[0];
  const seasonNumber = seasonNumberStr ? parseInt(seasonNumberStr, 10) : undefined;

  return {
    id: event.id,
    title,
    description,
    content,
    audioUrl,
    audioType,
    videoUrl,
    videoType,
    imageUrl,
    transcriptUrl,
    chaptersUrl,
    duration,
    episodeNumber,
    seasonNumber,
    publishDate,
    explicit: false,
    tags: topicTags,
    externalRefs: [],
    value,
    eventId: event.id,
    authorPubkey: event.pubkey,
    identifier,
    createdAt: new Date(event.created_at * 1000),
  };
}

/**
 * Validates if a Nostr event is a valid podcast trailer
 */
function validatePodcastTrailer(event: NostrEvent, creatorPubkeyHex: string): boolean {
  if (event.kind !== PODCAST_KINDS.TRAILER) return false;

  // Check for required title tag
  const title = event.tags.find(([name]) => name === 'title')?.[1];
  if (!title) return false;

  // Check for required URL tag
  const url = event.tags.find(([name]) => name === 'url')?.[1];
  if (!url) return false;

  // Check for required pubdate tag
  const pubdate = event.tags.find(([name]) => name === 'pubdate')?.[1];
  if (!pubdate) return false;

  // Verify it's from the podcast creator
  if (event.pubkey !== creatorPubkeyHex) return false;

  return true;
}

/**
 * Converts a validated Nostr event to a PodcastTrailer object
 */
function eventToPodcastTrailer(event: NostrEvent): PodcastTrailer {
  const tags = new Map(event.tags.map(([key, ...values]) => [key, values]));

  const title = tags.get('title')?.[0] || 'Untitled Trailer';
  const url = tags.get('url')?.[0] || '';
  const pubdateStr = tags.get('pubdate')?.[0];
  const lengthStr = tags.get('length')?.[0];
  const type = tags.get('type')?.[0];
  const seasonStr = tags.get('season')?.[0];
  
  // Parse pubdate (RFC2822 format)
  let pubDate: Date;
  try {
    pubDate = pubdateStr ? new Date(pubdateStr) : new Date(event.created_at * 1000);
  } catch {
    pubDate = new Date(event.created_at * 1000);
  }

  // Extract identifier from 'd' tag (for addressable events)
  const identifier = tags.get('d')?.[0] || event.id;

  return {
    id: event.id,
    title,
    url,
    pubDate,
    length: lengthStr ? parseInt(lengthStr, 10) : undefined,
    type,
    season: seasonStr ? parseInt(seasonStr, 10) : undefined,
    eventId: event.id,
    authorPubkey: event.pubkey,
    identifier,
    createdAt: new Date(event.created_at * 1000),
  };
}

/**
 * Fetch podcast metadata from multiple Nostr relays
 */
async function fetchPodcastMetadataMultiRelay(relays: Array<{url: string, relay: NRelay1}>, creatorPubkeyHex: string) {
  console.log('📡 Fetching podcast metadata from Nostr...');

  const relayPromises = relays.map(async ({url, relay}) => {
    try {
      const events = await Promise.race([
        relay.query([{
          kinds: [PODCAST_KINDS.PODCAST_METADATA],
          authors: [creatorPubkeyHex],
          '#d': ['podcast-metadata'],
          limit: 5
        }]),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Metadata query timeout for ${url}`)), 5000)
        )
      ]) as NostrEvent[];

      if (events.length > 0) {
        console.log(`✅ Found ${events.length} metadata events from ${url}`);
        return events;
      }
      return [];
    } catch (error) {
      console.log(`⚠️ Failed to fetch metadata from ${url}:`, (error as Error).message);
      return [];
    }
  });

  // Wait for all relays to respond or timeout
  const allResults = await Promise.allSettled(relayPromises);
  const allEvents: NostrEvent[] = [];

  allResults.forEach((result) => {
    if (result.status === 'fulfilled') {
      allEvents.push(...result.value);
    }
  });

  if (allEvents.length > 0) {
    // Get the most recent event from all relays
    const latestEvent = allEvents.reduce((latest, current) =>
      current.created_at > latest.created_at ? current : latest
    );

    const updatedAt = new Date(latestEvent.created_at * 1000);
    console.log(`✅ Found podcast metadata from Nostr (updated: ${updatedAt.toISOString()})`);
    console.log(`🎯 Using podcast metadata from Nostr`);

    const metadata = JSON.parse(latestEvent.content);
    return metadata;
  } else {
    console.log('⚠️ No podcast metadata found from any relay');
    console.log('📄 Using podcast metadata from config file');
    return null;
  }
}

/**
 * Fetch podcast episodes from multiple Nostr relays
 */
async function fetchPodcastEpisodesMultiRelay(relays: Array<{url: string, relay: NRelay1}>, creatorPubkeyHex: string) {
  console.log('📡 Fetching podcast episodes from Nostr...');

  const relayPromises = relays.map(async ({url, relay}) => {
    try {
      const events = await Promise.race([
        relay.query([{
          kinds: [PODCAST_KINDS.EPISODE],
          authors: [creatorPubkeyHex],
          limit: 100
        }]),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Episodes query timeout for ${url}`)), 5000)
        )
      ]) as NostrEvent[];

      const validEvents = events.filter(event => validatePodcastEpisode(event, creatorPubkeyHex));

      if (validEvents.length > 0) {
        console.log(`✅ Found ${validEvents.length} episodes from ${url}`);
        return validEvents;
      }
      return [];
    } catch (error) {
      console.log(`⚠️ Failed to fetch episodes from ${url}:`, (error as Error).message);
      return [];
    }
  });

  // Wait for all relays to respond or timeout
  const allResults = await Promise.allSettled(relayPromises);
  const allEvents: NostrEvent[] = [];

  allResults.forEach((result) => {
    if (result.status === 'fulfilled') {
      allEvents.push(...result.value);
    }
  });

  // Deduplicate addressable events by 'd' tag identifier (keep only latest version)
  const episodesByIdentifier = new Map<string, NostrEvent>();
  
  allEvents.forEach(event => {
    // Get the 'd' tag identifier for addressable events
    const identifier = event.tags.find(([name]) => name === 'd')?.[1];
    if (!identifier) return; // Skip events without 'd' tag
    
    const existing = episodesByIdentifier.get(identifier);
    // Keep the latest version (highest created_at timestamp)
    if (!existing || event.created_at > existing.created_at) {
      episodesByIdentifier.set(identifier, event);
    }
  });

  const uniqueEvents = Array.from(episodesByIdentifier.values());
  console.log(`✅ Found ${uniqueEvents.length} unique episodes from ${allResults.length} relays`);

  // Convert to PodcastEpisode format and sort by publishDate (newest first)
  const episodes = uniqueEvents.map(event => eventToPodcastEpisode(event));

  return episodes.sort((a, b) => b.publishDate.getTime() - a.publishDate.getTime());
}

/**
 * Fetch podcast trailers from multiple Nostr relays
 */
async function fetchPodcastTrailersMultiRelay(relays: Array<{url: string, relay: NRelay1}>, creatorPubkeyHex: string) {
  console.log('📡 Fetching podcast trailers from Nostr...');

  const relayPromises = relays.map(async ({url, relay}) => {
    try {
      const events = await Promise.race([
        relay.query([{
          kinds: [PODCAST_KINDS.TRAILER],
          authors: [creatorPubkeyHex],
          limit: 50
        }]),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Trailers query timeout for ${url}`)), 5000)
        )
      ]) as NostrEvent[];

      const validEvents = events.filter(event => validatePodcastTrailer(event, creatorPubkeyHex));

      if (validEvents.length > 0) {
        console.log(`✅ Found ${validEvents.length} trailers from ${url}`);
        return validEvents;
      }
      return [];
    } catch (error) {
      console.log(`⚠️ Failed to fetch trailers from ${url}:`, (error as Error).message);
      return [];
    }
  });

  // Wait for all relays to respond or timeout
  const allResults = await Promise.allSettled(relayPromises);
  const allEvents: NostrEvent[] = [];

  allResults.forEach((result) => {
    if (result.status === 'fulfilled') {
      allEvents.push(...result.value);
    }
  });

  // Deduplicate addressable events by 'd' tag identifier (keep only latest version)
  const trailersByIdentifier = new Map<string, NostrEvent>();
  
  allEvents.forEach(event => {
    // Get the 'd' tag identifier for addressable events
    const identifier = event.tags.find(([name]) => name === 'd')?.[1];
    if (!identifier) return; // Skip events without 'd' tag
    
    const existing = trailersByIdentifier.get(identifier);
    // Keep the latest version (highest created_at timestamp)
    if (!existing || event.created_at > existing.created_at) {
      trailersByIdentifier.set(identifier, event);
    }
  });

  const uniqueEvents = Array.from(trailersByIdentifier.values());
  console.log(`✅ Found ${uniqueEvents.length} unique trailers from ${allResults.length} relays`);

  // Convert to PodcastTrailer format
  const trailers = uniqueEvents.map(event => eventToPodcastTrailer(event));
  
  // Additional deduplication by URL + title combination (in case same content was published with different identifiers)
  const trailersByContent = new Map<string, PodcastTrailer>();
  
  trailers.forEach(trailer => {
    const contentKey = `${trailer.url}-${trailer.title}`;
    const existing = trailersByContent.get(contentKey);
    
    // Keep the latest version by publication date
    if (!existing || trailer.pubDate.getTime() > existing.pubDate.getTime()) {
      trailersByContent.set(contentKey, trailer);
    }
  });
  
  const finalTrailers = Array.from(trailersByContent.values());
  console.log(`🔄 Deduplicated to ${finalTrailers.length} unique trailers (removed ${trailers.length - finalTrailers.length} duplicates)`);
  
  // Sort by pubDate (newest first)
  return finalTrailers.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
}

async function buildRSS() {
  try {
    console.log('🏗️  Building RSS feed for production...');

    // Use the imported config directly
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

    let finalConfig: PodcastConfig = baseConfig;
    let episodes: PodcastEpisode[] = [];
    let trailers: PodcastTrailer[] = [];
    let nostrMetadata: Partial<PodcastConfig['podcast']> | null = null;

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
      episodes = await fetchPodcastEpisodesMultiRelay(relays, creatorPubkeyHex);

      // Fetch trailers from multiple relays
      trailers = await fetchPodcastTrailersMultiRelay(relays, creatorPubkeyHex);

    } finally {
      // Close all relay connections
      for (const { url, relay } of relays) {
        try {
          relay.close();
        } catch (error) {
          console.warn(`⚠️ Failed to close relay ${url}:`, error);
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

    // Write a .nojekyll file for GitHub Pages compatibility
    const nojekyllPath = path.join(distDir, '.nojekyll');
    await fs.writeFile(nojekyllPath, '');
    console.log(`✅ .nojekyll file generated for GitHub Pages compatibility`);

    console.log('\n🎉 RSS feed build completed successfully!');
    console.log('📡 Feed will be available at: /rss.xml');
    console.log('🏥 Health check available at: /rss-health');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error generating RSS feed:', error);
    process.exit(1);
  }
}

// Run the build
buildRSS();
