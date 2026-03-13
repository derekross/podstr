import { NPool, NRelay1 } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';

async function testSpecificEvent() {
  console.log('🧪 Testing query for specific event ID...');
  console.log('');

  // User's npub
  const npub = 'npub1sh0cy25xtx0lh6q58kc7rcdl95tzlfs0c6zuv4g4jclx0n7hfx0sghnh3u';
  const decoded = nip19.decode(npub);
  const pubkey = decoded.data as string;

  // Specific event from user's JSON
  const eventId = '164b7852adb480feb0a434a9ef10607db3cba2b855f649e644871810e8a4fa68';
  const dTag = 'fd9955bc-92a7-43fc-a8e9-877175cd42ae';

  console.log(`📋 npub: ${npub}`);
  console.log(`📋 pubkey: ${pubkey.substring(0, 12)}...`);
  console.log(`📋 Event ID: ${eventId}`);
  console.log(`📋 d-tag: ${dTag}`);
  console.log('');

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

  console.log('⏳ Querying by event ID...');
  const startTime = Date.now();

  try {
    // Query by specific event ID
    const events = await pool.query([
      {
        ids: [eventId],
        kinds: [30311],
      }
    ]);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('');
    console.log(`✅ Query completed in ${duration}s`);
    console.log(`📊 Found ${events.length} event(s)`);
    console.log('');

    if (events.length > 0) {
      console.log('🎉 SUCCESS! Fetched event by ID!');
      console.log('');
      events.forEach((event, i) => {
        console.log(`  Event #${i + 1}:`);
        console.log(`    ID: ${event.id}`);
        console.log(`    Kind: ${event.kind}`);
        console.log(`    Author: ${event.pubkey.substring(0, 12)}...`);
        console.log(`    d-tag: ${event.tags.find(([name]) => name === 'd')?.[1]}`);
        console.log(`    Title: ${event.tags.find(([name]) => name === 'title')?.[1]}`);
        console.log(`    Status: ${event.tags.find(([name]) => name === 'status')?.[1]}`);
      });
    } else {
      console.log('⚠️  No events found by ID');
    }

    console.log('');
    console.log('⏳ Now querying by pubkey only...');
    const startTime2 = Date.now();

    const eventsByPubkey = await pool.query([
      {
        kinds: [30311],
        authors: [pubkey],
        limit: 100,
      }
    ]);

    const duration2 = ((Date.now() - startTime2) / 1000).toFixed(2);
    console.log('');
    console.log(`✅ Query completed in ${duration2}s`);
    console.log(`📊 Found ${eventsByPubkey.length} event(s) by pubkey`);

    if (eventsByPubkey.length > 0) {
      console.log('');
      eventsByPubkey.forEach((event, i) => {
        console.log(`  Event #${i + 1}:`);
        console.log(`    ID: ${event.id}`);
        console.log(`    d-tag: ${event.tags.find(([name]) => name === 'd')?.[1]}`);
        console.log(`    Title: ${event.tags.find(([name]) => name === 'title')?.[1]}`);
      });
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

testSpecificEvent();
