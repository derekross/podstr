import { NPool, NRelay1 } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';

async function testLivestreamFetch() {
  console.log('🧪 Testing livestream fetch (kind 30311)...');

  // Test with a real pubkey format (this will fail but will show the connection works)
  const testNpub = 'npub1lxy69cpp35vx3dpk3w3j3k2m0f6xj9k3e6g3j3k2e6w35jy9k36xeqvcqv96k3'; // Invalid on purpose

  let targetPubkey: string;
  try {
    const decoded = nip19.decode(testNpub);
    if (decoded.type === 'npub') {
      targetPubkey = decoded.data;
      console.log(`✅ Decoded npub: ${targetPubkey.substring(0, 8)}...`);
    } else {
      console.log('⚠️  Could not decode npub (expected for this test)');
    }
  } catch (error) {
    console.error('❌ Failed to decode npub:', error);
  }

  // Use the single relay from the conversion script
  const relayUrl = 'wss://nos.lol';
  console.log(`📡 Using relay: ${relayUrl}`);

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
  const checkInterval = setInterval(() => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    console.log(`⏱ Elapsed: ${elapsed}s...`);
  }, 5000);

  try {
    const events = await pool.query([
      {
        kinds: [30311],
        authors: [targetPubkey],
        // No 'since' parameter - just get recent events
        limit: 20,
      }
    ], { signal: controller.signal });

    clearInterval(checkInterval);
    clearTimeout(timeoutId);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ Query completed in ${duration}s`);
    console.log(`📊 Found ${events.length} livestream(s)`);

    if (events.length > 0) {
      console.log('📝 Sample livestreams:');
      events.slice(0, Math.min(3, events.length)).forEach((event, i) => {
        const title = event.tags.find(([name]) => name === 'title')?.[1] || '(no title)';
        const dTag = event.tags.find(([name]) => name === 'd')?.[1];
        const status = event.tags.find(([name]) => name === 'status')?.[1] || '(no status)';
        console.log(`   ${i + 1}. ${title} (${status}) - d: ${dTag.substring(0, 12)}...`);
      });
    }

    // Close the pool
    console.log('🔚 Closing relay connections...');
    pool.close();

    process.exit(0);
  } catch (error) {
    clearInterval(checkInterval);
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('❌ Query timed out after 30 seconds');
      console.error('💡 This indicates the relay is unreachable or very slow');
    } else {
      console.error('❌ Error querying relays:', error instanceof Error ? error.message : error);
      if (error instanceof Error) {
        console.error('💡 Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack,
        });
      }
    }
    pool.close();
    process.exit(1);
  }
}

testLivestreamFetch().catch(error => {
  console.error('❌ Fatal error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
