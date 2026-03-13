import { NPool, NRelay1 } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';

async function testEventWithoutKind() {
  console.log('🧪 Testing query for event without kind filter...');
  console.log('');

  const npub = 'npub1sh0cy25xtx0lh6q58kc7rcdl95tzlfs0c6zuv4g4jclx0n7hfx0sghnh3u';
  const decoded = nip19.decode(npub);
  const pubkey = decoded.data as string;

  const eventId = '164b7852adb480feb0a434a9ef10607db3cba2b855f649e644871810e8a4fa68';

  console.log(`📋 pubkey: ${pubkey.substring(0, 12)}...`);
  console.log(`📋 Event ID: ${eventId}`);
  console.log('');

  const relayUrl = 'wss://nos.lol';
  console.log(`📡 Using relay: ${relayUrl}`);
  console.log('');

  const pool = new NPool({
    open: (url) => new NRelay1(url),
    reqRouter: (filters) => new Map([[relayUrl, filters]]),
  });

  console.log('⏳ Querying for event (no kind filter)...');

  try {
    const events = await pool.query([
      {
        ids: [eventId],
      }
    ]);

    console.log('');
    console.log(`📊 Found ${events.length} event(s)`);
    console.log('');

    if (events.length > 0) {
      console.log('🎉 SUCCESS! Event found!');
      events.forEach(event => {
        console.log(`  ID: ${event.id}`);
        console.log(`  Kind: ${event.kind}`);
        console.log(`  Author: ${event.pubkey.substring(0, 12)}...`);
        console.log(`  d-tag: ${event.tags.find(([name]) => name === 'd')?.[1]}`);
        console.log(`  Title: ${event.tags.find(([name]) => name === 'title')?.[1]}`);
        console.log(`  Content: ${event.content.substring(0, 100)}...`);
      });
    }

    pool.close();

    // Now let's see what kind 30054 events exist for this pubkey
    console.log('');
    console.log('⏳ Querying for kind 30054 (podcast episodes)...');

    const pool2 = new NPool({
      open: (url) => new NRelay1(url),
      reqRouter: (filters) => new Map([[relayUrl, filters]]),
    });

    const episodes = await pool2.query([
      {
        kinds: [30054],
        authors: [pubkey],
        limit: 50,
      }
    ]);

    console.log('');
    console.log(`📊 Found ${episodes.length} kind 30054 event(s)`);
    console.log('');

    if (episodes.length > 0) {
      console.log('🎉 Found podcast episodes!');
      episodes.slice(0, 5).forEach((event, i) => {
        console.log(`  Episode #${i + 1}:`);
        console.log(`    ID: ${event.id}`);
        console.log(`    d-tag: ${event.tags.find(([name]) => name === 'd')?.[1]}`);
        console.log(`    Title: ${event.tags.find(([name]) => name === 'title')?.[1]}`);
      });
    }

    pool2.close();
    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

testEventWithoutKind();
