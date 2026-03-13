import { NPool, NRelay1 } from '@nostrify/nostrify';

async function simpleTest() {
  console.log('🧪 Simple relay query test...');

  const relayUrl = 'wss://nos.lol';
  console.log(`📡 Using relay: ${relayUrl}`);

  // Query from multiple relays to find events
  const relays = [
    'wss://nos.lol',
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    'wss://relay.primal.net',
    'wss://relay.ditto.pub',
  ];

  console.log(`📡 Testing ${relays.length} relays to find events:`);
  relays.forEach((relay, i) => console.log(`   ${i + 1}. ${relay}`));

  const pool = new NPool({
    open: (url) => {
      console.log(`🔗 Connecting to relay: ${url}`);
      return new NRelay1(url);
    },
    reqRouter: (filters) => new Map(
      relays.map(relay => [relay, filters])
    ),
  });

  console.log('⏳ Waiting for relay responses...');
  const startTime = Date.now();

  pool.query([
    {
      kinds: [30311],
      authors: hex('f38a7f8e088ea727e316b990da29cdf8d13352b5fa095941114b83fefa4b67fa'),
      limit: 100,
    }
  ]).then(events => {
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
