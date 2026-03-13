/**
 * Verify RSS feed matches Nostr published episodes
 *
 * This script:
 * - Parses the generated RSS feed and counts items
 * - Queries Nostr for published podcast episodes (kind 30054)
 * - Compares the counts and fails if they don't match
 */

import { promises as fs } from 'fs';
import { nip19 } from 'nostr-tools';
import { NRelay1 } from '@nostrify/nostrify';
import { queryRelay } from './lib/relay-query';

const PODCAST_KIND = 30054;

/**
 * Parse RSS feed and count items
 */
async function countRSSItems(rssPath: string): Promise<number> {
  console.log('🔍 Parsing RSS feed...');

  try {
    const rssContent = await fs.readFile(rssPath, 'utf-8');
    const itemMatches = rssContent.match(/<item>/g);

    if (!itemMatches) {
      console.error('❌ No <item> tags found in RSS feed');
      return 0;
    }

    const itemCount = itemMatches.length;
    console.log(`✅ Found ${itemCount} items in RSS feed`);
    return itemCount;
  } catch (error) {
    console.error('❌ Failed to parse RSS feed:', error);
    throw error;
  }
}

/**
 * Query Nostr for published podcast episodes
 */
async function countPublishedEpisodes(creatorNpub: string): Promise<number> {
  console.log('🔍 Fetching published podcast episodes from Nostr...');

  // Decode npub to hex
  let creatorPubkey: string;
  try {
    const decoded = nip19.decode(creatorNpub);
    if (decoded.type === 'npub') {
      creatorPubkey = decoded.data;
    } else {
      throw new Error('Invalid npub format');
    }
  } catch (error) {
    console.error('❌ Failed to decode npub:', error);
    throw error;
  }

  console.log(`📋 Creator pubkey: ${creatorPubkey.substring(0, 8)}...`);

  // Query nos.lol directly using WebSocket
  const relayUrl = 'wss://nos.lol';
  console.log(`📡 Querying relay: ${relayUrl}`);

  try {
    const events = await queryRelay(relayUrl, {
      kinds: [PODCAST_KIND],
      authors: [creatorPubkey],
      limit: 500,
    });

    const duration = ((Date.now() - Date.now()) / 1000).toFixed(2);
    console.log(`✅ Query completed in ${duration}s`);
    console.log(`📊 Found ${events.length} published episode(s)`);
    return events.length;
  } catch (error) {
    console.error('❌ Error querying published episodes:', error instanceof Error ? error.message : error);
    throw error;
  }
}

/**
 * Main verification function
 */
async function main() {
  console.log('🔎 Verifying RSS feed against published Nostr episodes...\n');

  // Get configuration from environment
  const creatorNpub = process.env.PODCAST_CREATOR_NPUB;
  const rssPath = process.env.RSS_FEED_PATH || 'dist/rss.xml';

  // Validate configuration
  if (!creatorNpub) {
    console.error('❌ PODCAST_CREATOR_NPUB environment variable is required');
    process.exit(1);
  }

  try {
    // Count RSS items
    const rssItemCount = await countRSSItems(rssPath);

    // Count published Nostr episodes
    const nostrEpisodeCount = await countPublishedEpisodes(creatorNpub);

    // Compare counts
    console.log('\n📊 Verification Results:');
    console.log(`  RSS feed items: ${rssItemCount}`);
    console.log(`  Published Nostr episodes: ${nostrEpisodeCount}`);

    if (rssItemCount !== nostrEpisodeCount) {
      const diff = Math.abs(rssItemCount - nostrEpisodeCount);
      console.error(`\n❌ RSS feed count mismatch!`);
      console.error(`   RSS items: ${rssItemCount}`);
      console.error(`   Nostr episodes: ${nostrEpisodeCount}`);
      console.error(`   Difference: ${diff}`);
      process.exit(1);
    }

    console.log('\n✅ RSS feed count matches published episodes!');
    console.log(`   Both have ${rssItemCount} items`);
  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  }
}

// Run main function
main().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
