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
import { NRelay1 } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';
import { WebSocket } from 'ws';
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
import { queryRelay } from './lib/relay-query';

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
async function fetchLivestreams(_targetNpub: string, _since: number): Promise<NostrEvent[]> {
  console.log('🔍 Fetching livestreams from Nostr...');

  // Decode npub to hex
  let targetPubkey: string;
  try {
    const decoded = nip19.decode(_targetNpub);
    if (decoded.type === 'npub') {
      targetPubkey = decoded.data;
    } else {
      throw new Error('Invalid npub format');
    }
  } catch (error) {
    console.error('❌ Failed to decode npub:', error);
    throw error;
  }

  // Query nos.lol directly using WebSocket (NPool.query() has issues)
  const relayUrl = 'wss://nos.lol';
  console.log(`📡 Querying relay: ${relayUrl}`);
  console.log(`📋 Host pubkey (p tag): ${targetPubkey.substring(0, 8)}...`);
  console.log(`📋 Limit: 20`);
  console.log('');

  const startTime = Date.now();

  try {
    const events = await queryRelay(relayUrl, {
      kinds: [30311],
      '#p': [targetPubkey], // Filter by host p tag instead of authors
      limit: 20,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Query completed in ${duration}s`);
    console.log(`📊 Found ${events.length} livestream(s)`);
    return events;
  } catch (error) {
    console.error('❌ Error querying relay:', error instanceof Error ? error.message : error);
    throw error;
  }
}

/**
 * Fetch existing episodes for duplicate detection
 */
async function fetchExistingEpisodes(_targetNpub: string): Promise<NostrEvent[]> {
  console.log('🔍 Fetching existing episodes for duplicate detection...');

  // Decode npub to hex
  let targetPubkey: string;
  try {
    const decoded = nip19.decode(_targetNpub);
    if (decoded.type === 'npub') {
      targetPubkey = decoded.data;
    } else {
      throw new Error('Invalid npub format');
    }
  } catch (error) {
    console.error('❌ Failed to decode npub:', error);
    throw error;
  }

  console.log(`📋 Host pubkey (p tag): ${targetPubkey.substring(0, 8)}...`);

  // Query nos.lol directly using WebSocket
  const relayUrl = 'wss://nos.lol';
  console.log(`📡 Querying relay: ${relayUrl}`);

  const startTime = Date.now();

  try {
    const events = await queryRelay(relayUrl, {
      kinds: [30054],
      '#p': [targetPubkey], // Filter by host p tag for consistency
      limit: 200,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Query completed in ${duration}s`);
    console.log(`📊 Found ${events.length} existing episode(s)`);
    return events;
  } catch (error) {
    console.error('❌ Error querying existing episodes:', error instanceof Error ? error.message : error);
    throw error;
  }
}

/**
 * Create batch episode from multiple livestreams
 */
async function createBatchEpisode(
  livestreams: NostrEvent[],
  privateKey: string,
  nbunksec: string | undefined
): Promise<NostrEvent> {
  console.log(`🔄 Creating batch episode from ${livestreams.length} livestreams`);
  const eventIds = livestreams.map(e => e.id.substring(0, 8)).join(', ');
  console.log(`📋 Event IDs: ${eventIds}`);

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
  const combinedAudioUrl = await uploadCombinedAudio(combinedFilepath, privateKey, nbunksec);

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
    created_at: Math.floor(Date.now() / 1000), // Current timestamp
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
  privateKey: string,
  nbunksec: string | undefined
): Promise<NostrEvent> {
  const eventId = livestream.id;
  const dTag = livestream.tags.find(t => t[0] === 'd')?.[1] || 'unknown';
  const title = livestream.tags.find(([name]) => name === 'title')?.[1] || 'Untitled';
  console.log(`🔄 Creating single episode for event: ${eventId}... (${title})`);

  // Extract recording URL
  const audioUrl = extractRecordingUrl(livestream);
  if (!audioUrl) {
    throw new Error('No recording URL found');
  }

  // Generate metadata
  const summary = livestream.tags.find(([name]) => name === 'summary')?.[1] || '';
  const image = livestream.tags.find(([name]) => name === 'image')?.[1] || '';

  // Create signer
  const signer = createSigner(privateKey, nbunksec);

  const event = await signer.signEvent({
    kind: 30054,
    content: '',
    created_at: Math.floor(Date.now() / 1000), // Current timestamp
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
 * Publish episode to Nostr using direct WebSocket with explicit timeout
 */
async function publishEpisode(event: NostrEvent): Promise<void> {
  console.log('📡 Publishing episode to Nostr (nos.lol only)...');
  console.log(`   ========== RAW EVENT TO PUBLISH ==========`);
  console.log(JSON.stringify(event, null, 2));
  console.log(`   ==============================================`);
  console.log(`   Event ID: ${event.id}`);
  console.log(`   Event kind: ${event.kind}`);
  console.log(`   Event pubkey: ${event.pubkey}`);
  console.log(`   Event created_at: ${event.created_at}`);
  console.log(`   Number of tags: ${event.tags.length}`);

  const relayUrl = 'wss://nos.lol';
  const TIMEOUT_MS = 30_000;
  const startTime = Date.now();

  return new Promise<void>((resolve, reject) => {
    console.log(`   Connecting to ${relayUrl} with ${TIMEOUT_MS}ms timeout...`);

    let ws: WebSocket | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    // Set timeout
    timeoutId = setTimeout(() => {
      console.error(`   ❌ Timeout after ${TIMEOUT_MS}ms`);
      if (ws) {
        ws.close();
      }
      reject(new Error(`Publish timeout after ${TIMEOUT_MS}ms`));
    }, TIMEOUT_MS);

    try {
      ws = new WebSocket(relayUrl);

      ws.on('open', () => {
        console.log(`   WebSocket connected, sending EVENT message...`);

        // Send the event
        const eventMsg = JSON.stringify(['EVENT', event]);
        ws.send(eventMsg);

        console.log(`   EVENT message sent, waiting for OK response...`);
      });

      ws.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());
        console.log(`   Received message:`, message);

        if (message[0] === 'OK') {
          const eventId = message[1];
          const success = message[2];
          const msg = message[3];

          if (success) {
            console.log(`   ✅ Event accepted by relay! Event ID: ${eventId}`);
            console.log(`   Publish completed in ${Date.now() - startTime}ms`);

            // Clear timeout and close connection
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            if (ws) {
              ws.close();
            }
            resolve();
          } else {
            console.error(`   ❌ Event rejected by relay: ${msg}`);
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            if (ws) {
              ws.close();
            }
            reject(new Error(`Event rejected by relay: ${msg}`));
          }
        }
      });

      ws.on('error', (error: Error) => {
        console.error(`   ❌ WebSocket error:`, error.message);
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (ws) {
          ws.close();
        }
        reject(error);
      });

      ws.on('close', () => {
        console.log(`   WebSocket connection closed`);
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      });
    } catch (error) {
      console.error(`   ❌ Failed to create WebSocket:`, error);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      reject(error);
    }
  });
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
    console.log('🔍 Fetching livestreams from Nostr...');
    let livestreams: NostrEvent[];
    try {
      livestreams = await fetchLivestreams(config.targetNpub, state.lastProcessedTimestamp);
    } catch (error) {
      console.error('❌ Failed to fetch livestreams:', error instanceof Error ? error.message : error);
      console.error('💡 This may be due to relay connectivity issues. Try again later or check relay status.');
      process.exit(1);
    }

    // Log fetched livestreams
    console.log('\\n📝 Fetched livestreams:');
    livestreams.forEach((stream, i) => {
      const d = stream.tags.find(t => t[0] === 'd')?.[1];
      const title = stream.tags.find(([name]) => name === 'title')?.[1];
      console.log(`  ${i + 1}. Event ID: ${stream.id}`);
      console.log(`     d: ${d}`);
      console.log(`     title: ${title || 'No title'}`);
      console.log(`     created_at: ${stream.created_at}`);
    });
    console.log('');

    if (livestreams.length === 0) {
      console.error('❌ No livestreams found - this may indicate an issue with:');
      console.error('   1. The LIVESTREAM_AUTHOR_NPUB secret is incorrect');
      console.error('   2. The relay (nos.lol) does not have events from this pubkey');
      console.error('   3. Network connectivity issues');
      console.error('');
      console.error(`📋 Currently querying for npub: ${config.targetNpub}`);
      console.error(`📋 Decoded pubkey: ${targetPubkey}`);
      process.exit(1);
    }

    // Fetch existing episodes for duplicate detection
    console.log('🔍 Fetching existing episodes for duplicate detection...');
    let existingEpisodes: NostrEvent[];
    try {
      existingEpisodes = await fetchExistingEpisodes(config.targetNpub);
    } catch (error) {
      console.error('❌ Failed to fetch existing episodes:', error instanceof Error ? error.message : error);
      console.error('💡 This may be due to relay connectivity issues. Try again later or check relay status.');
      process.exit(1);
    }

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
        const groupEventIds = group.map(g => g.id.substring(0, 8)).join(', ');
        console.log(`\\n📦 Processing batch group of ${group.length} event(s): ${groupEventIds}`);

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
          const episode = await createBatchEpisode(group, config.nostrPrivateKey, config.nbunksec);

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
          console.error(`❌ Failed to process group (event IDs: ${groupEventIds}):`, error);
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
        const eventId = livestream.id;
        const dTag = livestream.tags.find(t => t[0] === 'd')?.[1] || 'unknown';
        const title = livestream.tags.find(([name]) => name === 'title')?.[1] || 'Untitled';
        console.log(`\\n📌 Processing event: ${eventId} (d: ${dTag}, title: "${title}")`);

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
          const episode = await createSingleEpisode(livestream, config.nostrPrivateKey, config.nbunksec);

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
          console.error(`❌ Failed to process livestream (event ID: ${eventId}):`, error);
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
