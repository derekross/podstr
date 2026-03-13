import { NPool, NRelay1 } from '@nostrify/nostrify';

async function fetchSpecificEvent() {
  console.log('🧪 Fetching the specific event you showed me...');
  console.log('');

  const eventId = '164b7852adb480feb0a434a9ef10607db3cba2b855f649e644871810e8a4fa68';
  const dTag = 'fd9955bc-92a7-43fc-a8e9-877175cd42ae';
  const pubkey = '85df822a86599ffbe8143db1e1e1bf2d162fa60fc685c65515963e67cfd7499f';

  console.log(`📋 Event ID: ${eventId}`);
  console.log(`📋 d-tag: ${dTag}`);
  console.log(`📋 pubkey: ${pubkey.substring(0, 12)}...`);
  console.log('');

  const relays = [
    'wss://nos.lol',
    'wss://relay.damus.io',
    'wss://relay.primal.net',
    'wss://relay.nostr.band',
    'wss://relay.ditto.pub',
  ];

  for (const relayUrl of relays) {
    console.log(`📡 Querying ${relayUrl}...`);

    const pool = new NPool({
      open: (url) => new NRelay1(url),
      reqRouter: (filters) => new Map([[relayUrl, filters]]),
    });

    try {
      // Try multiple query strategies
      const strategies = [
        { name: 'By ID', filter: { ids: [eventId] } },
        { name: 'By ID + Kind 30311', filter: { ids: [eventId], kinds: [30311] } },
        { name: 'By Pubkey + Kind 30311', filter: { authors: [pubkey], kinds: [30311], limit: 50 } },
        { name: 'By Pubkey + d-tag', filter: { authors: [pubkey], '#d': [dTag], kinds: [30311], limit: 50 } },
      ];

      for (const strategy of strategies) {
        try {
          const events = await Promise.race([
            pool.query([strategy.filter]),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
          ]) as any[];

          if (events.length > 0) {
            console.log(`   ✅ ${strategy.name}: Found ${events.length} event(s)!`);
            events.forEach(event => {
              console.log(`      Kind: ${event.kind}`);
              console.log(`      ID: ${event.id}`);
              console.log(`      Title: ${event.tags.find(([name]) => name === 'title')?.[1]}`);
            });
          } else {
            console.log(`   ${strategy.name}: 0 events`);
          }
        } catch (err: any) {
          console.log(`   ${strategy.name}: ${err.message === 'Timeout' ? 'Timeout' : err.message}`);
        }
      }

    } catch (error) {
      console.log(`   Relay error: ${error instanceof Error ? error.message : error}`);
    }

    pool.close();
    console.log('');
  }

  process.exit(0);
}

fetchSpecificEvent();
