import { queryRelay } from './lib/relay-query';

async function testNewQuery() {
  console.log('🧪 Testing new relay query method...');
  console.log('');

  const pubkey = '85df822a86599ffbe8143db1e1e1bf2d162fa60fc685c65515963e67cfd7499f';
  const relayUrl = 'wss://nos.lol';

  console.log('⏳ Querying for kind 30311 livestreams...');
  const startTime = Date.now();

  try {
    const events = await queryRelay(relayUrl, {
      kinds: [30311],
      authors: [pubkey],
      limit: 20,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('');
    console.log(`✅ Query completed in ${duration}s`);
    console.log(`📊 Found ${events.length} livestream(s)`);
    console.log('');

    if (events.length > 0) {
      console.log('🎉 SUCCESS! Livestreams found!');
      events.slice(0, 5).forEach((event, i) => {
        const title = event.tags.find(([name]) => name === 'title')?.[1];
        console.log(`  ${i + 1}. ${title || '(no title)'}`);
      });
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

testNewQuery();
