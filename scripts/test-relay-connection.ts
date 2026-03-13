import { NPool, NRelay1 } from '@nostrify/nostrify';

async function testRelayConnection() {
  console.log('🧪 Testing relay connection (no specific npub required)...');

  const relayUrl = 'wss://nos.lol';
  console.log(`📡 Testing connection to relay: ${relayUrl}`);

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
    console.warn('⏰ Connection timeout reached (30s), aborting...');
    controller.abort();
  }, 30000);

  console.log('⏳ Waiting for connection...');

  const startTime = Date.now();

  try {
    // Simple query just to test connection
    const events = await pool.query([
      {
        kinds: [0], // Kind 0 (metadata) - always has events
        limit: 1, // Only need 1 event to verify connection
      }
    ], { signal: controller.signal });

    clearTimeout(timeoutId);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ Connection successful! Query completed in ${duration}s`);
    console.log(`📊 Received ${events.length} event(s) from relay`);

    // Close the pool
    console.log('🔚 Closing relay connections...');
    pool.close();

    process.exit(0);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('❌ Connection timed out after 30 seconds');
      console.error('💡 This indicates the relay is unreachable or very slow');
    } else {
      console.error('❌ Error connecting to relay:', error instanceof Error ? error.message : error);
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

testRelayConnection().catch(error => {
  console.error('❌ Fatal error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
