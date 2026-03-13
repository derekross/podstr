import { NPool, NRelay1 } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';

async function simpleTest() {
  console.log('🧪 Simple relay query test...');

  // Convert npub to hex pubkey for proper querying
  const npub = 'npub1sh0cy25xtx0lh6q58kc7rcdl95tzlfs0c6zuv4g4jclx0n7hfx0sghnh3u';
  const pubkey = nip19.decode(npub).data;

  console.log(`📋 Using npub: ${npub}`);
  console.log(`📋 Converted to pubkey: ${pubkey.substring(0, 8)}...`);

  // Query from single relay (ONLY nos.lol as requested)
  const relayUrl = 'wss://nos.lol';
  console.log(`📡 Using relay: ${relayUrl}`);

  const pool = new NPool({
    open: (url) => {
      console.log(`🔗 Connecting to relay: ${url}`);
      return new NRelay1(url);
    },
    reqRouter: (filters) => new Map([[relayUrl, filters]]),
  });

  console.log('⏳ Waiting for relay responses...');

  const startTime = Date.now();

  // For NIP-11 (kind 30311) livestreams, events are identified by the 'd' tag (replaceable)
  // The correct query is by 'ids' and '#d' together, not by 'author'
  // Extract the 'd' tag from the JSON you sent
  const eventId = '164b7852adb480feb0a434a9ef10607db3cba2b855f649e644871810e8a4fa68';
  const dTag = 'fd9955bc-92a7-43fc-a8e9-877175cd42ae';

  console.log('📋 Looking for event with id: ' + eventId);
  console.log('📋 Looking for d-tag: ' + dTag);

  pool.query([
    {
      ids: [eventId],
      kinds: [30311],
      limit: 100,
    }
  ]).then(events => {.then(events => {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ Query completed in ${duration}s`);
    console.log(`📊 Found ${events.length} livestream(s)`);

    if (events.length > 0) {
      console.log('');
      console.log('🎉 SUCCESS! I fetched actual kind 30311 events from the relay!');
      console.log('');
      console.log('📝 Here are the notes that were fetched:');
      console.log('');

      events.slice(0, Math.min(5, events.length)).forEach((event, i) => {
        const title = event.tags.find(([name]) => name === 'title')?.[1] || '(no title)';
        const dTag = event.tags.find(([name]) => name === 'd')?.[1];
        console.log(`   ${i + 1}. ${title} (d: ${dTag.substring(0, 12)})`);
      });
    }

    pool.close();
    process.exit(0);
  }).catch(error => {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    pool.close();
    process.exit(1);
  });
}

simpleTest().catch(error => {
  console.error('❌ Fatal error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
