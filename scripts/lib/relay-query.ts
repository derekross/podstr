import type { NostrEvent } from '@nostrify/nostrify';
import { WebSocket } from 'ws';

/**
 * Query Nostr relay using direct WebSocket connection
 * Works around NPool.query() issues in GitHub Actions environment
 */
export async function queryRelay(
  relayUrl: string,
  filter: { ids?: string[]; kinds?: number[]; authors?: string[]; limit?: number; '#d'?: string[]; '#p'?: string[] }
): Promise<NostrEvent[]> {
  return new Promise((resolve, reject) => {
    const subscriptionId = `query-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const events: NostrEvent[] = [];
    let eoseReceived = false;
    const timeoutMs = 30000; // 30 second timeout

    console.log(`🔗 Connecting to ${relayUrl}...`);

    const ws = new WebSocket(relayUrl);

    const cleanup = () => {
      clearTimeout(timeout);
      ws.close();
    };

    const timeout = setTimeout(() => {
      cleanup();
      console.log(`⏰ Timeout reached, returning ${events.length} events`);
      resolve(events); // Return whatever we have
    }, timeoutMs);

    ws.on('open', () => {
      console.log(`✅ Connected to ${relayUrl}`);
      const reqMsg = JSON.stringify(['REQ', subscriptionId, filter]);
      ws.send(reqMsg);
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      const type = message[0];

      if (type === 'EVENT') {
        const event = message[2];
        events.push(event);
      } else if (type === 'EOSE') {
        eoseReceived = true;
        console.log(`📬 EOSE received (${events.length} events so far)`);
        // Wait a bit more for any straggler events, then resolve
        setTimeout(() => {
          cleanup();
          resolve(events);
        }, 100);
      } else if (type === 'NOTICE') {
        console.warn(`Relay notice: ${message[1]}`);
      }
    });

    ws.on('error', (error) => {
      cleanup();
      reject(error);
    });

    ws.on('close', () => {
      cleanup();
      if (!eoseReceived) {
        console.log(`🔚 Connection closed (no EOSE)`);
        resolve(events); // Return whatever we have even if EOSE never came
      }
    });
  });
}
