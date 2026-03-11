/**
 * State persistence and loading for livestream conversion
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ConversionState } from './conversion-types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_FILE = path.join(__dirname, '..', '..', '.github', 'conversion-state.json');

/**
 * Load conversion state from disk
 */
export async function loadConversionState(): Promise<ConversionState> {
  try {
    const content = await fs.readFile(STATE_FILE, 'utf-8');
    console.log('📂 Loading conversion state from:', STATE_FILE);
    return JSON.parse(content) as ConversionState;
  } catch {
    console.log('📂 No state file found, using default state');
    return {
      lastProcessedTimestamp: 0,
      processedLivestreams: {}
    };
  }
}

/**
 * Save conversion state to disk
 */
export async function saveConversionState(state: ConversionState): Promise<void> {
  const dir = path.dirname(STATE_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  console.log('💾 Conversion state saved to:', STATE_FILE);
}
