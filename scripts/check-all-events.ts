import { NPool, NRelay1 } from '@nostrify/nostrify';

async function checkAllLivestreams() {
  console.log('🧪 Checking for ANY kind 30311 events on nos.lol...');
  console.log('');

  const relayUrl = 'wss://nos.lol';
  console.log(`📡 Using relay: ${relayUrl}`);
  console.log('');

  const pool = new NPool({
    open: (url) => new NRelay1(url),
    reqRouter: (filters) => new Map([[relayUrl, filters]]),
  });

  console.log('⏳ Querying for all kind 30311 events...');
  const startTime = Date.now();

  try {
    const events = await pool.query([
      {
        kinds: [30311],
        limit: 50,
      }
    ]);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('');
    console.log(`✅ Query completed in ${duration}s`);
    console.log(`📊 Found ${events.length} kind 30311 event(s)`);
    console.log('');

    if (events.length > 0) {
      console.log('🎉 Events found!');
      console.log('');
      events.slice(0, 10).forEach((event, i) => {
        console.log(`Event #${i + 1}:`);
        console.log(`  ID: ${event.id}`);
        console.log(`  Author: ${event.pubkey.substring(0, 12)}...`);
        console.log(`  Kind: ${event.kind}`);
        console.log(`  d-tag: ${event.tags.find(([name]) => name === 'd')?.[1]}`);
        console.log(`  Title: ${event.tags.find(([name]) => name === 'title')?.[1]}`);
        console.log(`  Status: ${event.tags.find(([name]) => name === 'status')?.[1]}`);
        console.log('');
      });
    } else {
      console.log('⚠️  No kind 30311 events found on this relay');
    }

    pool.close();

    // Also check kind 30054
    console.log('');
    console.log('⏳ Querying for all kind 30054 events...');
    const pool2 = new NPool({
      open: (url) => new NRelay1(url),
      reqRouter: (filters) => new Map([[relayUrl, filters]]),
    });

    const episodes = await pool2.query([
      {
        kinds: [30054],
        limit: 50,
      }
    ]);

    console.log('');
    console.log(`📊 Found ${episodes.length} kind 30054 event(s)`);
    console.log('');

    if (episodes.length > 0) {
      episodes.slice(0, 10).forEach((event, i) => {
        console.log(`Episode #${i + 1}:`);
        console.log(`  ID: ${event.id}`);
        console.log(`  Author: ${event.pubkey.substring(0, 12)}...`);
        console.log(`  d-tag: ${event.tags.find(([name]) => name === 'd')?.[1]}`);
        console.log(`  Title: ${event.tags.find(([name]) => name === 'title')?.[1]}`);
        console.log('');
      });
    }

    pool2.close();
    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

checkAllLivestreams();
