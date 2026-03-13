/**
 * NIP-46 bunker signer using snstr library
 * Wraps snstr's SimpleNIP46Client to implement NostrSigner interface
 */

import type { NostrSigner } from '@nostrify/nostrify';
import { SimpleNIP46Client } from 'snstr';

export class NSyteBunkerSigner implements NostrSigner {
  private client: SimpleNIP46Client;
  private userPubkey: string;
  private initialized: boolean = false;

  /**
   * Create bunker signer
   * @param bunkerUrl - bunker://<pubkey>?relay=<relay> format (or full nbunksec string)
   * @param nbunksec - nbunksec format with secret for authentication
   */
  constructor(bunkerUrl: string, nbunksec: string) {
    // Use nbunksec directly as it contains both the bunker URL and secret
    // Format: bunker://<pubkey>?relay=<relay>&secret=<secret>
    // or bunker://<pubkey>?relay=<relay>
    const urlMatch = nbunksec.match(/bunker:\/\/([^?]+)\?relay=([^&]+)/);
    if (!urlMatch) {
      console.log(`🔍 Debug: nbunksec value (first 50 chars): ${nbunksec.substring(0, 50)}...`);
      throw new Error('Invalid bunker URL format. Expected: bunker://<pubkey>?relay=<relay>');
    }

    const relay = urlMatch[2];

    // Extract secret from nbunksec if present
    // Format: bunker://<pubkey>?relay=<relay>&secret=<secret>
    const secretMatch = nbunksec.match(/secret=([a-zA-Z0-9_-]+)/);
    const secret = secretMatch ? secretMatch[1] : '';

    // Build connection string with secret
    // Format: bunker://<signer-pubkey>?relay=<relay>&secret=<secret>
    const connectionString = nbunksec;

    // Create client
    this.client = new SimpleNIP46Client([relay], {
      timeout: 30000,
    });
    this.userPubkey = '';

    // Store connection string for later use
    this.client.connect(connectionString).then((pubkey) => {
      this.userPubkey = pubkey;
      this.initialized = true;
    }).catch((error) => {
      throw new Error(`Failed to connect to bunker: ${error instanceof Error ? error.message : 'Unknown error'}`);
    });
  }

  async getPublicKey(): Promise<string> {
    // Wait for initialization
    if (!this.initialized) {
      // Connection is async in constructor, wait a bit
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return this.userPubkey;
  }

  async signEvent<K extends number>(
    event: Omit<{ kind: K; created_at: number; content: string; tags: string[][]; pubkey: string }, 'id' | 'pubkey' | 'sig'>
  ): Promise<{ kind: K; created_at: number; content: string; tags: string[][]; pubkey: string; id: string; sig: string }> {
    // Ensure we're connected
    if (!this.initialized) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      if (!this.initialized) {
        throw new Error('Bunker not connected yet');
      }
    }

    // Sign event through snstr client
    const signed = await this.client.signEvent(event);
    return signed as { kind: K; created_at: number; content: string; tags: string[][]; pubkey: string; id: string; sig: string };
  }

  async nip04Encrypt(_pubkey: string, _plaintext: string): Promise<string> {
    throw new Error('nip04 not implemented for bunker signer');
  }

  async nip04Decrypt(_pubkey: string, _ciphertext: string): Promise<string> {
    throw new Error('nip04 not implemented for bunker signer');
  }

  async nip44Encrypt(_pubkey: string, _plaintext: string): Promise<string> {
    throw new Error('nip44 not implemented for bunker signer');
  }

  async nip44Decrypt(_pubkey: string, _ciphertext: string): Promise<string> {
    throw new Error('nip44 not implemented for bunker signer');
  }
}
