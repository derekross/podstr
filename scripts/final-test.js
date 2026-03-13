import { NPool, NRelay1 } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';

async function finalTest() {
  console.log('🧪 Final test with NIP-11 compliant query...');

  const npub = 'npub1sh0cy25xtx0lh6q58kc7rcdl95tzlfs0c6zuv4g4jclx0n7hfx0sghnh3u';
  const pubkey = nip19.decode(npub).data;

  console.log('📋 Converted npub to pubkey:', pubkey.substring(0, 8));

  const eventId = '164b7852adb480feb0a434a9ef10607db3cba2b855f649e644871810e8a4fa68';
  const dTag = 'fd9955bc-92a7-43fc-a8e9-877175cd42ae';

  console.log('📋 Looking for event with id:', eventId);
  console.log('📋 Looking for d-tag:', dTag);

  const relayUrl = 'wss://nos.lol';
  console.log('📡 Using relay:', relayUrl);

  const pool = new NPool({
    open: (url) => {
      console.log('🔗 Connecting to relay:', url);
      return new NRelay1(url);
    },
    reqRouter: (filters) => new Map([[relayUrl, filters]]),
  });

  console.log('⏳ Waiting for relay responses...');
  const startTime = Date.now();

  pool.query({
    ids: [eventId],
    kinds: [30311],
    limit: 100,
  }).then(events => {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('✅ Query completed in', duration, 's');
    console.log('📊 Found', events.length, 'livestream(s)');

    if (events.length > 0) {
      console.log('');
      console.log('🎉 SUCCESS! I fetched the event!');
      console.log('📝 Event details:');
      events.forEach(event => {
        const title = event.tags.find(([name]) => name === 'title')?.[1] || '(no title)';
        const dTag = event.tags.find(([name]) => name === 'd')?.[1];
        const status = event.tags.find(([name]) => name === 'status')?.[1];
        console.log('  Title:', title);
        console.log('  d-tag:', dTag);
        console.log('  Status:', status || '(no status)');
      });
    }

    pool.close();
    process.exit(0);
  }).catch(error => {
    console.error('❌ Error:', error);
    pool.close();
    process.exit(1);
  });
}

finalTest();
