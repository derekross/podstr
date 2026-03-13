import { NPool, NRelay1 } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';

async function testMultipleRelays() {
  console.log('🧪 Testing multiple relays for the event...');
  console.log('');

  const npub = 'npub1sh0cy25xtx0lh6q58kc7rcdl95tzlfs0c6zuv4g4jclx0n7hfx0sghnh3u';
  const decoded = nip19.decode(npub);
  const pubkey = decoded.data as string;

  const eventId = '164b7852adb480feb0a434a9ef10607db3cba2b855f649e644871810e8a4fa68';

  console.log(`📋 npub: ${npub}`);
  console.log(`📋 pubkey: ${pubkey.substring(0, 12)}...`);
  console.log(`📋 Event ID: ${eventId}`);
  console.log('');

  // Test multiple relays
  const relays = [
    'wss://nos.lol',
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    'wss://relay.primal.net',
  ];

  for (const relayUrl of relays) {
    console.log(`📡 Testing relay: ${relayUrl}`);

    const pool = new NPool({
      open: (url) => {
        return new NRelay1(url);
      },
      reqRouter: (filters) => new Map([[relayUrl, filters]]),
    });

    try {
      // Query by event ID
      const eventsById = await Promise.race([
        pool.query([{ ids: [eventId] }]),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]) as any[];

      console.log(`   Found ${eventsById.length} event(s) by ID`);

      if (eventsById.length > 0) {
        console.log(`   ✅ Event found on this relay!`);
        eventsById.forEach(event => {
          console.log(`      Kind: ${event.kind}`);
          console.log(`      d-tag: ${event.tags.find(([name]) => name === 'd')?.[1]}`);
          console.log(`      Title: ${event.tags.find(([name]) => name === 'title')?.[1]}`);
        });
      }

      // Query by pubkey for kind 30311
      const eventsByPubkey = await Promise.race([
        pool.query([{ kinds: [30311], authors: [pubkey], limit: 100 }]),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]) as any[];

      console.log(`   Found ${eventsByPubkey.length} kind 30311 event(s) by pubkey`);

      if (eventsByPubkey.length > 0) {
        console.log(`   ✅ Livestreams found on this relay!`);
        eventsByPubkey.slice(0, 3).forEach(event => {
          console.log(`      ID: ${event.id}`);
          console.log(`      d-tag: ${event.tags.find(([name]) => name === 'd')?.[1]}`);
          console.log(`      Title: ${event.tags.find(([name]) => name === 'title')?.[1]}`);
        });
      }

    } catch (error: any) {
      if (error.message === 'Timeout') {
        console.log(`   ⏱️  Timeout after 5s`);
      } else {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }

    pool.close();
    console.log('');
  }

  process.exit(0);
}

testMultipleRelays();
