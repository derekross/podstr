async function publishEpisode(event: NostrEvent): Promise<void> {
  console.log('📡 Publishing episode to Nostr (nos.lol only)...');
  console.log(`   ========== RAW EVENT TO PUBLISH ==========`);
  console.log(JSON.stringify(event, null, 2));
  console.log(`   ==============================================`);
  console.log(`   Event ID: ${event.id}`);
  console.log(`   Event kind: ${event.kind}`);
  console.log(`   Event pubkey: ${event.pubkey}`);
  console.log(`   Event created_at: ${event.created_at}`);
  console.log(`   Number of tags: ${event.tags.length}`);
  console.log(`   About to call relay.event()...`);

  // Only publish to nos.lol for now (simpler debugging)
  const relayUrl = 'wss://nos.lol';

  console.log(`   Connecting to relay: ${relayUrl}`);

  try {
    const relay = new NRelay1(relayUrl);
    await relay.event(event);
    console.log('   ✅ Published successfully! Event ID:', relay.event.id);
  } catch (error) {
    console.error('   ❌ Failed to publish:', error.message);
  }
}
