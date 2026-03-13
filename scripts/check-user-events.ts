import { NPool, NRelay1 } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';

async function checkUserEvents() {
  console.log('🧪 Checking what events the user has...');
  console.log('');

  const npub = 'npub1sh0cy25xtx0lh6q58kc7rcdl95tzlfs0c6zuv4g4jclx0n7hfx0sghnh3u';
  const decoded = nip19.decode(npub);
  const pubkey = decoded.data as string;

  console.log(`📋 npub: ${npub}`);
  console.log(`📋 pubkey: ${pubkey.substring(0, 12)}...`);
  console.log('');

  const relayUrl = 'wss://nos.lol';
  console.log(`📡 Using relay: ${relayUrl}`);
  console.log('');

  const pool = new NPool({
    open: (url) => new NRelay1(url),
    reqRouter: (filters) => new Map([[relayUrl, filters]]),
  });

  console.log('⏳ Querying for ALL events from this user...');
  const startTime = Date.now();

  try {
    // Query without kind filter to get all events
    const events = await pool.query([
      {
        authors: [pubkey],
        limit: 100,
      }
    ]);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('');
    console.log(`✅ Query completed in ${duration}s`);
    console.log(`📊 Found ${events.length} total event(s)`);
    console.log('');

    // Group by kind
    const byKind: Record<number, number> = {};
    events.forEach(event => {
      byKind[event.kind] = (byKind[event.kind] || 0) + 1;
    });

    console.log('📊 Events by kind:');
    Object.keys(byKind)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach(kind => {
        console.log(`  Kind ${kind}: ${byKind[kind]} event(s)`);
      });

    console.log('');

    // Show some examples
    if (events.length > 0) {
      console.log('📝 Sample events:');
      events.slice(0, 10).forEach((event, i) => {
        console.log(`  ${i + 1}. Kind ${event.kind}, ID: ${event.id}`);
        if (event.kind === 30311) {
          const title = event.tags.find(([name]) => name === 'title')?.[1];
          console.log(`     Title: ${title}`);
        }
      });
    }

    pool.close();
    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

checkUserEvents();
