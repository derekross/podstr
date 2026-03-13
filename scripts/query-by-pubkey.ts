import { NPool, NRelay1 } from '@nostrify/nostrify';

async function queryByPubkey() {
  console.log('🧪 Querying by pubkey on nos.lol...');
  console.log('');

  const pubkey = '85df822a86599ffbe8143db1e1e1bf2d162fa60fc685c65515963e67cfd7499f';
  const eventId = '164b7852adb480feb0a434a9ef10607db3cba2b855f649e644871810e8a4fa68';

  console.log(`📋 Pubkey: ${pubkey}`);
  console.log(`📋 Event ID: ${eventId}`);
  console.log('');

  const relayUrl = 'wss://nos.lol';
  console.log(`📡 Using relay: ${relayUrl}`);
  console.log('');

  const pool = new NPool({
    open: (url) => {
      console.log(`🔗 Connecting to ${url}`);
      return new NRelay1(url);
    },
    reqRouter: (filters) => new Map([[relayUrl, filters]]),
  });

  console.log('⏳ Querying ALL events for this pubkey (no kind filter)...');
  const startTime = Date.now();

  try {
    // Query with just pubkey, no kind filter
    const events = await pool.query([
      {
        authors: [pubkey],
        limit: 500,
      }
    ]);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('');
    console.log(`✅ Query completed in ${duration}s`);
    console.log(`📊 Found ${events.length} total event(s)`);
    console.log('');

    if (events.length > 0) {
      console.log('📝 Events found:');
      events.forEach((event, i) => {
        console.log(`  ${i + 1}. Kind: ${event.kind}, ID: ${event.id}`);
        if (event.kind === 30311) {
          const title = event.tags.find(([name]) => name === 'title')?.[1];
          const dTag = event.tags.find(([name]) => name === 'd')?.[1];
          console.log(`     Title: ${title}`);
          console.log(`     d-tag: ${dTag}`);
        }
      });
    } else {
      console.log('⚠️  No events found for this pubkey on nos.lol');
    }

    pool.close();
    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    console.error('Stack:', error instanceof Error ? error.stack : '');
    pool.close();
    process.exit(1);
  }
}

queryByPubkey();
