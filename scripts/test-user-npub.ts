import { NPool, NRelay1 } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';

async function testUserNpub() {
  console.log('🧪 Testing relay query for user npub...');
  console.log('');

  // User's npub
  const npub = 'npub1sh0cy25xtx0lh6q58kc7rcdl95tzlfs0c6zuv4g4jclx0n7hfx0sghnh3u';

  // Convert npub to hex pubkey
  const decoded = nip19.decode(npub);
  if (decoded.type !== 'npub') {
    console.error('❌ Invalid npub format');
    process.exit(1);
  }
  const pubkey = decoded.data as string;

  console.log(`📋 npub: ${npub}`);
  console.log(`📋 pubkey: ${pubkey.substring(0, 12)}...`);
  console.log('');

  // Use only nos.lol as requested
  const relayUrl = 'wss://nos.lol';
  console.log(`📡 Using relay: ${relayUrl}`);
  console.log('');

  const pool = new NPool({
    open: (url) => {
      console.log(`🔗 Connecting to relay: ${url}`);
      return new NRelay1(url);
    },
    reqRouter: (filters) => new Map([[relayUrl, filters]]),
  });

  console.log('⏳ Querying for kind 30311 livestreams...');
  const startTime = Date.now();

  try {
    // Query for kind 30311 events by author
    const events = await pool.query([
      {
        kinds: [30311],
        authors: [pubkey],
        limit: 100,
      }
    ]);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('');
    console.log(`✅ Query completed in ${duration}s`);
    console.log(`📊 Found ${events.length} livestream(s)`);
    console.log('');

    if (events.length > 0) {
      console.log('🎉 SUCCESS! Fetched events for user!');
      console.log('');
      console.log('📝 Event details:');
      events.forEach((event, i) => {
        const title = event.tags.find(([name]) => name === 'title')?.[1] || '(no title)';
        const dTag = event.tags.find(([name]) => name === 'd')?.[1];
        const status = event.tags.find(([name]) => name === 'status')?.[1];
        const streaming = event.tags.find(([name]) => name === 'streaming')?.[1];
        const recording = event.tags.find(([name]) => name === 'recording')?.[1];

        console.log('');
        console.log(`  Event #${i + 1}:`);
        console.log(`    ID: ${event.id}`);
        console.log(`    Title: ${title}`);
        console.log(`    d-tag: ${dTag}`);
        console.log(`    Status: ${status || '(no status)'}`);
        console.log(`    Streaming: ${streaming ? 'Yes' : 'No'}`);
        console.log(`    Recording: ${recording ? 'Yes' : 'No'}`);
        console.log(`    Created: ${new Date(event.created_at * 1000).toISOString()}`);
      });
    } else {
      console.log('⚠️  No events found for this npub');
    }

    pool.close();
    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('❌ Error querying relay:', error instanceof Error ? error.message : error);
    pool.close();
    process.exit(1);
  }
}

testUserNpub();
