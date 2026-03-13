/**
 * Main conversion script for converting Nostr livestreams to podcast episodes
 *
 * This script:
 * - Queries Nostr for kind 30311 livestreams
 * - Validates and filters livestreams
 * - Groups by hour for batch conversion
 * - Combines audio using ffmpeg (batch mode)
 * - Uploads to Blossom servers
 * - Creates kind 30054 episodes with nsec bunker signing
 * - Persists state to prevent duplicates
 * - Updates RSS feed automatically
 */

import { Console } from 'console';
import type { NostrEvent } from '@nostrify/nostrify';
import { NPool, NRelay1 } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';
import type {
  LivestreamConversionConfig,
  LivestreamConversionSummary,
} from './lib/conversion-types';
import { loadConversionState, saveConversionState } from './lib/conversion-state';
import {
  extractRecordingUrl,
  shouldSkipLivestream,
  isLivestreamConverted,
  groupLivestreamsForBatch,
  combineAudioFiles,
  uploadCombinedAudio,
  createSigner,
} from './lib/conversion-utils';

// Custom console for consistent logging
const console = new Console({
  stdout: process.stdout,
  stderr: process.stderr,
});

/**
 * Parse command line arguments
 */
function parseArgs(): Partial<LivestreamConversionConfig> {
  const args = process.argv.slice(2);
  const config: Partial<LivestreamConversionConfig> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--batch-mode=true' || arg === '--batch-mode=true') {
      config.batchMode = true;
    } else if (arg.startsWith('--livestream-ids=')) {
      config.livestreamIds = arg.split('=')[1];
    }
  }

  return config;
}

/**
 * Fetch livestreams from Nostr
 */
async function fetchLivestreams(targetNpub: string, since: number): Promise<NostrEvent[]> {
  console.log('🔍 Fetching livestreams from Nostr...');

  // Decode npub to hex
  let targetPubkey: string;
  try {
    const decoded = nip19.decode(targetNpub);
    if (decoded.type === 'npub') {
      targetPubkey = decoded.data;
    } else {
      throw new Error('Invalid npub format');
    }
  } catch (error) {
    console.error('❌ Failed to decode npub:', error);
    throw error;
  }

  // Create NPool for querying relays
  const pool = new NPool({
    open: (url) => new NRelay1(url),
    reqRouter: (filters) => new Map([
      ['wss://relay.primal.net', filters],
      ['wss://relay.nostr.band', filters],
      ['wss://relay.damus.io', filters],
      ['wss://nos.lol', filters],
      ['wss://relay.ditto.pub', filters],
    ]),
  });

  console.log(`📡 Querying relays for kind 30311 livestreams from pubkey: ${targetPubkey.substring(0, 8)}...`);
  console.log(`📋 Using 'since' timestamp: ${since} (${new Date(since * 1000).toISOString()})`);

  // Query for kind 30311 livestreams with timeout
  const signal = AbortSignal.timeout(60000); // 60 second timeout
  const events = await pool.query([
    {
      kinds: [30311],
      authors: [targetPubkey],
      since,
      limit: 100,
    }
  ], { signal });

  console.log(`✅ Found ${events.length} livestream(s) from relays`);

  return events;
}

/**
 * Fetch existing episodes for duplicate detection
 */
async function fetchExistingEpisodes(targetNpub: string): Promise<NostrEvent[]> {
  console.log('🔍 Fetching existing episodes for duplicate detection...');

  // Decode npub to hex
  let targetPubkey: string;
  try {
    const decoded = nip19.decode(targetNpub);
    if (decoded.type === 'npub') {
      targetPubkey = decoded.data;
    } else {
      throw new Error('Invalid npub format');
    }
  } catch (error) {
    console.error('❌ Failed to decode npub:', error);
    throw error;
  }

  console.log(`📡 Querying relays for kind 30054 episodes from pubkey: ${targetPubkey.substring(0, 8)}...`);

  // Create NPool for querying relays
  const pool = new NPool({
    open: (url) => new NRelay1(url),
    reqRouter: (filters) => new Map([
      ['wss://relay.primal.net', filters],
      ['wss://relay.nostr.band', filters],
      ['wss://relay.damus.io', filters],
      ['wss://nos.lol', filters],
      ['wss://relay.ditto.pub', filters],
    ]),
  });

  // Query for kind 30054 episodes with timeout
  const signal = AbortSignal.timeout(60000); // 60 second timeout
  const events = await pool.query([
    {
      kinds: [30054],
      authors: [targetPubkey],
      limit: 200, // Get more episodes for duplicate checking
    }
  ], { signal });

  console.log(`✅ Found ${events.length} existing episode(s) from relays`);

  return events;
}

/**
 * Create batch episode from multiple livestreams
 */
async function createBatchEpisode(
  livestreams: NostrEvent[],
  privateKey: string
): Promise<NostrEvent> {
  console.log(`🔄 Creating batch episode from ${livestreams.length} livestreams`);

  // Extract recording URLs
  const audioUrls = livestreams
    .map(stream => extractRecordingUrl(stream))
    .filter((url): url is string => url !== null);

  if (audioUrls.length === 0) {
    throw new Error('No recording URLs found for batch conversion');
  }

  // Combine audio with ffmpeg
  const combinedFilepath = await combineAudioFiles(
    audioUrls,
    `batch-combined-${Date.now()}.mp3`
  );

  // Upload combined audio to Blossom
  const combinedAudioUrl = await uploadCombinedAudio(combinedFilepath, privateKey, config.nbunksec);

  // Generate title from first livestream
  const firstStream = livestreams[0];
  const title = firstStream.tags.find(([name]) => name === 'title')?.[1] || 'Batch Episode';
  const summary = firstStream.tags.find(([name]) => name === 'summary')?.[1] || '';
  const image = firstStream.tags.find(([name]) => name === 'image')?.[1] || '';

  // Generate association tags for all livestreams
  const livestreamTags = livestreams.map(stream => {
    const dTag = stream.tags.find(t => t[0] === 'd')?.[1];
    return ['livestream', `30311:${stream.pubkey}:${dTag}`];
  });

  // Create signer
  const signer = createSigner(privateKey, config.nbunksec);
  const dTag = `batch-livestreams-${Date.now()}`;

  const event = await signer.signEvent({
    kind: 30054,
    content: '',
    tags: [
      ['d', dTag],
      ['title', title],
      ['summary', summary],
      ['audio', combinedAudioUrl],
      ['image', image],
      ['duration', '0'], // Could calculate from combined audio
      ['alt', `Batch podcast episode combining ${livestreams.length} livestreams`],
      ['client', 'podstr-github-actions'], // NIP-89 client identification
      ['t', 'livestream'], // Category tag
      ...livestreamTags, // Association tags
    ]
  });

  console.log(`✅ Episode created: ${dTag}`);

  return event;
}

/**
 * Create single episode from one livestream
 */
async function createSingleEpisode(
  livestream: NostrEvent,
  privateKey: string
): Promise<NostrEvent> {
  console.log('🔄 Creating single episode...');

  // Extract recording URL
  const audioUrl = extractRecordingUrl(livestream);
  if (!audioUrl) {
    throw new Error('No recording URL found');
  }

  // Generate metadata
  const title = livestream.tags.find(([name]) => name === 'title')?.[1] || 'Untitled Episode';
  const summary = livestream.tags.find(([name]) => name === 'summary')?.[1] || '';
  const image = livestream.tags.find(([name]) => name === 'image')?.[1] || '';
  const dTag = livestream.tags.find(t => t[0] === 'd')?.[1] || `episode-${Date.now()}`;

  // Create signer
  const signer = createSigner(privateKey, config.nbunksec);

  const event = await signer.signEvent({
    kind: 30054,
    content: '',
    tags: [
      ['d', dTag],
      ['title', title],
      ['summary', summary],
      ['audio', audioUrl],
      ['image', image],
      ['duration', '0'], // Could calculate from audio
      ['alt', `Podcast episode: ${title}`],
      ['client', 'podstr-github-actions'], // NIP-89 client identification
      ['t', 'livestream'], // Category tag
      ['livestream', `30311:${livestream.pubkey}:${dTag}`], // Association tag
    ]
  });

  console.log(`✅ Episode created: ${dTag}`);

  return event;
}

/**
 * Publish episode to Nostr
 */
async function publishEpisode(event: NostrEvent): Promise<void> {
  console.log('📡 Publishing episode to Nostr...');

  // Create NPool for querying relays
  const pool = new NPool({
    open: (url) => new NRelay1(url),
    eventRouter: () => {
      // Route to all relays
      return ['wss://relay.primal.net', 'wss://relay.nostr.band', 'wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.ditto.pub'];
    },
  });

  // Publish to relays
  await pool.publish(event);

  console.log(`✅ Episode published successfully`);
}

/**
 * Main conversion process
 */
async function main() {
  console.log('🚀 Starting livestream-to-episode conversion...');

  // Parse arguments
  const args = parseArgs();

  // Get configuration from environment
  const config: LivestreamConversionConfig = {
    batchMode: args.batchMode || process.env.BATCH_MODE === 'true',
    livestreamIds: args.livestreamIds || process.env.LIVESTREAM_IDS,
    nostrPrivateKey: process.env.NOSTR_PRIVATE_KEY!,
    nbunksec: process.env.NBUNKSEC,
    targetNpub: process.env.LIVESTREAM_AUTHOR_NPUB!,
  };

  // Validate configuration
  if (!config.nbunksec && !config.nostrPrivateKey) {
    console.error('❌ Either NBUNKSEC or NOSTR_PRIVATE_KEY environment variable is required');
    process.exit(1);
  }

  if (!config.targetNpub) {
    console.error('❌ LIVESTREAM_AUTHOR_NPUB environment variable is required');
    process.exit(1);
  }

  console.log('📋 Configuration:');
  console.log('  - Batch mode:', config.batchMode);
  console.log('  - Target npub:', config.targetNpub);
  console.log('  - Relays: wss://relay.primal.net, wss://relay.nostr.band, wss://relay.damus.io, wss://nos.lol, wss://relay.ditto.pub');

  try {
    // Load state
    const state = await loadConversionState();
    console.log('📂 Last processed timestamp:', new Date(state.lastProcessedTimestamp * 1000).toISOString());

    // Fetch livestreams
    const livestreams = await fetchLivestreams(config.targetNpub, state.lastProcessedTimestamp);

    if (livestreams.length === 0) {
      console.log('✅ No new livestreams to process');
      return;
    }

    // Fetch existing episodes for duplicate detection
    const existingEpisodes = await fetchExistingEpisodes(config.targetNpub);

    // Process livestreams
    const summaries: LivestreamConversionSummary[] = [];
    const convertedCount = { value: 0 };
    const skippedCount = { value: 0 };
    const failedCount = { value: 0 };

    if (config.batchMode) {
      // Group livestreams by hour
      const byHour = groupLivestreamsForBatch(livestreams);
      const groups = Object.values(byHour);

      console.log(`📊 Grouped into ${groups.length} batch group(s)`);

      // Process each group
      for (const group of groups) {
        try {
          // Check if any livestream in group has been converted
          const hasConverted = group.some(stream => isLivestreamConverted(stream, existingEpisodes));

          if (hasConverted) {
            console.log(`⏭️  Skipping group (already converted)`);
            skippedCount.value += group.length;
            group.forEach(stream => {
              summaries.push({
                livestreamAddress: `${stream.pubkey}:${stream.tags.find(t => t[0] === 'd')?.[1]}`,
                title: stream.tags.find(([name]) => name === 'title')?.[1] || 'Untitled',
                status: 'skipped',
                reason: 'Already converted',
              });
            });
            continue;
          }

          // Skip cancelled streams
          const skipResults = group.map(stream => shouldSkipLivestream(stream));
          const shouldSkipGroup = skipResults.some(r => r.skip);

          if (shouldSkipGroup) {
            console.log(`⏭️  Skipping group (contains cancelled/future streams)`);
            skipResults.forEach((r, i) => {
              if (r.skip) {
                skippedCount.value++;
                summaries.push({
                  livestreamAddress: `${group[i].pubkey}:${group[i].tags.find(t => t[0] === 'd')?.[1]}`,
                    title: group[i].tags.find(([name]) => name === 'title')?.[1] || 'Untitled',
                    status: 'skipped',
                    reason: r.reason,
                  });
              }
            });
            continue;
          }

          // Create batch episode
          const episode = await createBatchEpisode(group, config.nostrPrivateKey);

          // Publish to Nostr
          await publishEpisode(episode);

          // Update summaries
          convertedCount.value += group.length;
          group.forEach(stream => {
            const dTag = stream.tags.find(t => t[0] === 'd')?.[1];
            summaries.push({
              livestreamAddress: `${stream.pubkey}:${dTag}`,
              title: stream.tags.find(([name]) => name === 'title')?.[1] || 'Untitled',
              episodeId: episode.tags.find(t => t[0] === 'd')?.[1],
              status: 'success',
            });
          });

          // Update state
          const now = Math.floor(Date.now() / 1000);
          group.forEach(stream => {
            const dTag = stream.tags.find(t => t[0] === 'd')?.[1];
            state.processedLivestreams[`${stream.pubkey}:${dTag}`] = {
              address: `${stream.pubkey}:${dTag}`,
              timestamp: stream.created_at,
              episodeId: episode.tags.find(t => t[0] === 'd')?.[1],
              status: 'success',
            };
          });
          state.lastProcessedTimestamp = now;
        }
        catch (error) {
          console.error('❌ Failed to process group:', error);
          failedCount.value += group.length;
          group.forEach(stream => {
            summaries.push({
              livestreamAddress: `${stream.pubkey}:${stream.tags.find(t => t[0] === 'd')?.[1]}`,
                title: stream.tags.find(([name]) => name === 'title')?.[1] || 'Untitled',
                status: 'failed',
                reason: error instanceof Error ? error.message : 'Unknown error',
              });
            });
      }
    }
  } else {
      // Single mode
      console.log('📊 Processing in single mode...');

      for (const livestream of livestreams) {
        try {
          // Check if already converted
          if (isLivestreamConverted(livestream, existingEpisodes)) {
            const dTag = livestream.tags.find(t => t[0] === 'd')?.[1];
            console.log(`⏭️  Skipping (already converted): ${dTag}`);
            skippedCount.value++;
            summaries.push({
              livestreamAddress: `${livestream.pubkey}:${dTag}`,
              title: livestream.tags.find(([name]) => name === 'title')?.[1] || 'Untitled',
              status: 'skipped',
              reason: 'Already converted',
            });
            continue;
          }

          // Skip if cancelled
          const skipResult = shouldSkipLivestream(livestream);
          if (skipResult.skip) {
            skippedCount.value++;
            summaries.push({
              livestreamAddress: `${livestream.pubkey}:${livestream.tags.find(t => t[0] === 'd')?.[1]}`,
                title: livestream.tags.find(([name]) => name === 'title')?.[1] || 'Untitled',
                status: 'skipped',
                reason: skipResult.reason,
              });
            continue;
          }

          // Create single episode
          const episode = await createSingleEpisode(livestream, config.nostrPrivateKey);

          // Publish to Nostr
          await publishEpisode(episode);

          // Update summaries
          convertedCount.value++;
          const dTag = livestream.tags.find(t => t[0] === 'd')?.[1];
          summaries.push({
            livestreamAddress: `${livestream.pubkey}:${dTag}`,
            title: livestream.tags.find(([name]) => name === 'title')?.[1] || 'Untitled',
            episodeId: episode.tags.find(t => t[0] === 'd')?.[1],
            status: 'success',
          });

          // Update state
          state.processedLivestreams[`${livestream.pubkey}:${dTag}`] = {
            address: `${livestream.pubkey}:${dTag}`,
            timestamp: livestream.created_at,
            episodeId: episode.tags.find(t => t[0] === 'd')?.[1],
            status: 'success',
          };
          state.lastProcessedTimestamp = Math.floor(Date.now() / 1000);
        }
        catch (error) {
          console.error('❌ Failed to process livestream:', error);
          failedCount.value++;
          summaries.push({
            livestreamAddress: `${livestream.pubkey}:${livestream.tags.find(t => t[0] === 'd')?.[1]}`,
              title: livestream.tags.find(([name]) => name === 'title')?.[1] || 'Untitled',
              status: 'failed',
              reason: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
    }

    // Save state
    await saveConversionState(state);

    // Log summary
    console.log('\n📊 Conversion Summary:');
    console.log(`  Total livestreams: ${livestreams.length}`);
    console.log(`  Converted: ${convertedCount.value}`);
    console.log(`  Skipped: ${skippedCount.value}`);
    console.log(`  Failed: ${failedCount.value}`);

    if (failedCount.value > 0) {
      console.log('\n❌ Failed conversions:');
      summaries.filter(s => s.status === 'failed').forEach(s => {
        console.log(`  - ${s.livestreamAddress}: ${s.title} (${s.reason})`);
      });
    }

    if (failedCount.value === 0) {
      console.log('\n✅ All conversions successful!');
    } else {
      console.log('\n⚠️  Some conversions failed. Check logs for details.');
      process.exit(1);
  }
  } catch (error) {
    console.error('\n❌ Fatal error during conversion:', error);
    process.exit(1);
  }
}

// Run main function
main().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
