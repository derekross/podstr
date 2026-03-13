import { NPool, NRelay1 } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';

async function showFetchedNotes() {
  console.log('🧪 Querying for kind 30311 livestreams to show results...');

  // Using a known test npub that has livestreams
  // Using hex format directly to avoid bech32 decode issues
  const testPubkey = 'f38a7f8e088ea727e316b990da29cdf8d13352b5fa095941114b83fefa4b67fa';

  let targetPubkey: string;
  try {
    targetPubkey = testPubkey;
  } catch (error) {
    console.error('Error setting target pubkey:', error);
    process.exit(1);
  }

  // Use the single relay from the conversion script
  const relayUrl = 'wss://nos.lol';
  console.log(`📡 Using relay: ${relayUrl}`);

  const pool = new NPool({
    open: (url) => {
      console.log(`🔗 Connecting to relay: ${url}`);
      return new NRelay1(url);
    },
    reqRouter: (filters) => new Map([[relayUrl, filters]]),
  });

  console.log('⏳ Waiting for relay responses...');

  const startTime = Date.now();

  try {
    console.log('🔍 Fetching kind 30311 livestreams...');
    const events = await pool.query([
      {
        kinds: [30311],
        authors: [targetPubkey],
        limit: 20, // Same limit as conversion script
      }
    ]);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ Query completed in ${duration}s`);
    console.log('');
    console.log(`📊 Found ${events.length} livestream(s)`);

    if (events.length > 0) {
      console.log('');
      console.log('🎉 SUCCESS! I fetched actual kind 30311 events from the relay!');
      console.log('');
      console.log('📝 Here are the notes that were fetched:');
      console.log('');

      events.slice(0, Math.min(5, events.length)).forEach((event, i) => {
        const title = event.tags.find(([name]) => name === 'title')?.[1] || '(no title)';
        const dTag = event.tags.find(([name]) => name === 'd')?.[1];
        const status = event.tags.find(([name]) => name === 'status')?.[1] || '(no status)';
        const image = event.tags.find(([name]) => name === 'image')?.[1] || '(no image)';
        const starts = event.tags.find(([name]) => name === 'starts')?.[1];
        const recording = event.tags.find(([name]) => name === 'recording')?.[1] || '(no recording)';
        const streaming = event.tags.find(([name]) => name === 'streaming')?.[1];

        console.log('');
        console.log(`Note #${i + 1}:`);
        console.log(`  Title: ${title}`);
        console.log(`  d-tag: ${dTag}`);
        console.log(`  Status: ${status}`);
        console.log(`  Image: ${image ? 'Yes' : 'No'}`);
        console.log(`  Starts: ${starts ? new Date(parseInt(starts) * 1000).toISOString() : 'N/A'}`);
        console.log(`  Recording: ${recording ? 'Yes' : 'No'}`);
        console.log(`  Streaming: ${streaming ? 'Yes' : 'No'}`);
        console.log(`  Created: ${new Date(event.created_at * 1000).toISOString()}`);
      });

      if (events.length > 5) {
        console.log('');
        console.log(`... and ${events.length - 5} more (not shown)`);
      }
    } else {
      console.log('');
      console.log('⚠️  No events found');
      console.log('💡 This might be expected if:');
      console.log('   1. The author has no kind 30311 events');
      console.log('   2. The relay doesn\'t have these events');
    }

    // Close the pool
    console.log('🔚 Closing relay connections...');
    pool.close();

    process.exit(0);
  } catch (error) {
    console.error('❌ Error querying relays:', error instanceof Error ? error.message : error);
    pool.close();
    process.exit(1);
  }
}

showFetchedNotes().catch(error => {
  console.error('❌ Fatal error:', error instanceof Error ? error.message : error);
  pool?.close();
  process.exit(1);
});
