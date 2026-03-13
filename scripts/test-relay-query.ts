import { NPool, NRelay1 } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';

async function testRelayQuery() {
  console.log('🧪 Testing relay query for kind 30311 livestreams...');

  // Test npub (using a real pubkey format)
  const testNpub = 'npub1lxy69cpp35vx3dpk3w3j3k2m0f6xj9k3e6g3j3k2e6w35jy9k36xeqvcqv96k3'; // This is just for testing structure

  let targetPubkey: string;
  try {
    const decoded = nip19.decode(testNpub);
    if (decoded.type === 'npub') {
      targetPubkey = decoded.data;
      console.log(`✅ Decoded npub: ${targetPubkey.substring(0, 8)}...`);
    } else {
      throw new Error('Invalid npub format');
    }
  } catch (error) {
    console.error('❌ Failed to decode npub:', error);
    throw error;
  }

  // Test with a recent timestamp (30 days ago)
  const since = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);

  console.log(`📋 Using 'since' timestamp: ${since} (${new Date(since * 1000).toISOString()})`);

  // Create NPool with single relay
  const relayUrl = 'wss://nos.lol';
  console.log(`📡 Connecting to relay: ${relayUrl}`);

  const pool = new NPool({
    open: (url) => {
      console.log(`🔗 Connection attempt: ${url}`);
      return new NRelay1(url);
    },
    reqRouter: (filters) => new Map([[relayUrl, filters]]),
  });

  // Query with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.warn('⏰ Query timeout reached (30s), aborting...');
    controller.abort();
  }, 30000);

  console.log('⏳ Waiting for relay responses...');

  const startTime = Date.now();

  try {
    const events = await pool.query([
      {
        kinds: [30311],
        authors: [targetPubkey],
        since,
        limit: 20,
      }
    ], { signal: controller.signal });

    clearTimeout(timeoutId);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ Query completed in ${duration}s`);
    console.log(`📊 Found ${events.length} livestream(s)`);

    if (events.length > 0) {
      console.log('📝 Sample livestreams:');
      events.slice(0, Math.min(3, events.length)).forEach((event, i) => {
        const title = event.tags.find(([name]) => name === 'title')?.[1] || '(no title)';
        const dTag = event.tags.find(([name]) => name === 'd')?.[1];
        console.log(`   ${i + 1}. ${title} (d: ${dTag.substring(0, 12)}...)`);
      });
    } else {
      console.log('⚠️  No livestreams found (this is expected if the author has no kind 30311 events)');
    }

    // Close the pool
    console.log('🔚 Closing relay connections...');
    pool.close();

    process.exit(0);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('❌ Query timed out after 30 seconds');
    } else {
      console.error('❌ Error querying relays:', error instanceof Error ? error.message : error);
    }
    pool.close();
    process.exit(1);
  }
}

testRelayQuery().catch(error => {
  console.error('❌ Fatal error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
