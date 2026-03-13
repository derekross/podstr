import { NPool, NRelay1 } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';

const eventId = '164b7852adb480feb0a434a9ef10607db3cba2b855f649e644871810e8a4fa68';
const dTag = 'fd9955bc-92a7-43fc-a8e9-877175cd42ae';

console.log('🧪 Testing NIP-11 query by ID and d-tag...');
console.log('📋 Event ID:', eventId);
console.log('📋 d-tag:', dTag);

const relayUrl = 'wss://nos.lol';
console.log('📡 Using relay:', relayUrl);

new NPool({
  open: (url) => {
      console.log('🔗 Connecting to relay:', url);
      return new NRelay1(url);
    },
    reqRouter: (filters) => new Map([[relayUrl, filters]]),
});

console.log('⏳ Querying...');

const pool = new NPool({
  open: (url) => {
      console.log('🔗 Connecting to relay:', url);
      return new NRelay1(url);
    },
  reqRouter: (filters) => new Map([[relayUrl, filters]]),
});

pool.query([
  {
    ids: [eventId],
    kinds: [30311],
  },
]).then(events => {
  console.log('✅ Found', events.length, 'events');

  if (events.length > 0) {
    console.log('🎉 SUCCESS! Fetched event!');
    console.log('📝 Event:');
    const event = events[0];
    console.log('  kind:', event.kind);
    console.log('  id:', event.id);
    console.log('  d-tag:', event.tags.find(t => t[0] === 'd' ? t[1] : 'none');
  }

  pool.close();
  process.exit(0);
}).catch(error => {
  console.error('❌ Error:', error);
  pool.close();
  process.exit(1);
});
