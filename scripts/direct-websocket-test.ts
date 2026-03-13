import { WebSocket } from 'ws';

async function directWebSocketQuery() {
  console.log('🧪 Direct WebSocket query to nos.lol...');
  console.log('');

  const pubkey = '85df822a86599ffbe8143db1e1e1bf2d162fa60fc685c65515963e67cfd7499f';
  const eventId = '164b7852adb480feb0a434a9ef10607db3cba2b855f649e644871810e8a4fa68';

  console.log(`📋 Pubkey: ${pubkey.substring(0, 12)}...`);
  console.log(`📋 Event ID: ${eventId}`);
  console.log('');

  const relayUrl = 'wss://nos.lol';
  const subscriptionId = 'test-' + Date.now();

  return new Promise((resolve) => {
    console.log(`🔗 Connecting to ${relayUrl}...`);
    const ws = new WebSocket(relayUrl);

    ws.on('open', () => {
      console.log('✅ Connected!');

      // Query by event ID
      const reqMsg = JSON.stringify([
        'REQ',
        subscriptionId,
        { ids: [eventId] }
      ]);
      console.log(`📤 Sending query for event ID...`);
      ws.send(reqMsg);

      // Also query by pubkey
      setTimeout(() => {
        const reqMsg2 = JSON.stringify([
          'REQ',
          subscriptionId + '-pubkey',
          { authors: [pubkey], limit: 100 }
        ]);
        console.log(`📤 Sending query for pubkey...`);
        ws.send(reqMsg2);
      }, 1000);
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      const type = message[0];

      if (type === 'EVENT') {
        const event = message[2];
        console.log(`\n✅ RECEIVED EVENT!`);
        console.log(`   Kind: ${event.kind}`);
        console.log(`   ID: ${event.id}`);
        console.log(`   Author: ${event.pubkey.substring(0, 12)}...`);
        console.log(`   Tags: ${JSON.stringify(event.tags.slice(0, 5))}`);

        if (event.kind === 30311) {
          const title = event.tags.find(([name]) => name === 'title')?.[1];
          console.log(`   🎉 KIND 30311 LIVESTREAM FOUND!`);
          console.log(`   Title: ${title}`);
        }
      } else if (type === 'EOSE') {
        console.log(`\n📬 End of Stored Events for subscription: ${message[1]}`);
      } else if (type === 'NOTICE') {
        console.log(`\n📢 NOTICE: ${message[1]}`);
      }
    });

    ws.on('error', (error) => {
      console.log(`\n❌ WebSocket error: ${error.message}`);
    });

    ws.on('close', () => {
      console.log(`\n🔚 Connection closed`);
      resolve(undefined);
    });

    // Close after 10 seconds
    setTimeout(() => {
      console.log(`\n⏰ Timeout, closing connection...`);
      ws.close();
    }, 10000);
  });
}

directWebSocketQuery().then(() => process.exit(0));
