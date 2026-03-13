import { NPool, NRelay1 } from '@nostrify/nostrify';

async function checkShoshoRelay() {
  console.log('🧪 Checking shosho.live relay...');
  console.log('');

  const eventId = '164b7852adb480feb0a434a9ef10607db3cba2b855f649e644871810e8a4fa68';
  const pubkey = '85df822a86599ffbe8143db1e1e1bf2d162fa60fc685c65515963e67cfd7499f';

  // Try shosho.live relay (common pattern: relay.shosho.live)
  const potentialRelays = [
    'wss://relay.shosho.live',
    'wss://nostr.shosho.live',
    'wss://shosho.live',
  ];

  for (const relayUrl of potentialRelays) {
    console.log(`📡 Trying ${relayUrl}...`);

    const pool = new NPool({
      open: (url) => new NRelay1(url),
      reqRouter: (filters) => new Map([[relayUrl, filters]]),
    });

    try {
      const events = await Promise.race([
        pool.query([{ ids: [eventId] }]),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
      ]) as any[];

      if (events.length > 0) {
        console.log(`   ✅ Found event on ${relayUrl}!`);
        console.log(`      Kind: ${events[0].kind}`);
        console.log(`      Title: ${events[0].tags.find(([name]) => name === 'title')?.[1]}`);
      } else {
        console.log(`   No events found`);
      }
    } catch (error: any) {
      console.log(`   Error: ${error.message}`);
    }

    pool.close();
    console.log('');
  }

  process.exit(0);
}

checkShoshoRelay();
