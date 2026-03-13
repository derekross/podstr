import { NPool, NRelay1 } from '@nostrify/nostrify';

async function findRelayWithEvents() {
  console.log('🧪 Finding relays that have kind 30311 events...');
  console.log('');

  const npub = 'npub1sh0cy25xtx0lh6q58kc7rcdl95tzlfs0c6zuv4g4jclx0n7hfx0sghnh3u';
  const { nip19 } = await import('nostr-tools');
  const decoded = nip19.decode(npub);
  const pubkey = decoded.data as string;

  const relays = [
    'wss://relay.ditto.pub',
    'wss://relay.primal.net',
    'wss://relay.nostr.band',
    'wss://nos.lol',
    'wss://relay.damus.io',
  ];

  for (const relayUrl of relays) {
    console.log(`📡 Checking ${relayUrl}...`);

    const pool = new NPool({
      open: (url) => new NRelay1(url),
      reqRouter: (filters) => new Map([[relayUrl, filters]]),
    });

    try {
      // Check for ANY kind 30311 events
      const allEvents = await Promise.race([
        pool.query([{ kinds: [30311], limit: 10 }]),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]) as any[];

      console.log(`   Found ${allEvents.length} kind 30311 events total`);

      // Check for user's kind 30311 events
      const userEvents = await Promise.race([
        pool.query([{ kinds: [30311], authors: [pubkey], limit: 10 }]),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]) as any[];

      console.log(`   Found ${userEvents.length} kind 30311 events for user`);

      if (userEvents.length > 0) {
        console.log(`   ✅ USER'S EVENTS FOUND ON THIS RELAY!`);
        userEvents.forEach(event => {
          console.log(`      ID: ${event.id}`);
          console.log(`      d-tag: ${event.tags.find(([name]) => name === 'd')?.[1]}`);
          console.log(`      Title: ${event.tags.find(([name]) => name === 'title')?.[1]}`);
        });
      }

    } catch (error: any) {
      if (error.message === 'Timeout') {
        console.log(`   ⏱️  Timeout`);
      }
    }

    pool.close();
    console.log('');
  }

  process.exit(0);
}

findRelayWithEvents();
