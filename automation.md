# Implementation Plan: Converting Nostr Livestreams to Podcast Episodes

## Overview

This plan outlines a complete implementation strategy for automatically converting NIP-53 livestream events (kind 30311) to NIP-54 podcast episodes (kind 30054) using a GitHub Actions workflow. The implementation supports batch conversion, skips cancelled streams, uses Shoshou recordings, and automatically updates RSS feed.

## User Requirements

1. **Recording Quality**: Always use Shoshou recording (from download tag)
2. **Episode Creation**: Batch conversion mode - multiple livestreams can become one podcast episode
3. **Cancelled Streams**: Skip livestreams that are cancelled or never happened (status=cancelled)
4. **RSS Update**: Automatic RSS feed update after conversion

## Architecture Analysis

### Current System

1. **Podcast Configuration**: Located at `/home/shepherd/Nextcloud/Projects/lab/podstr/src/lib/podcastConfig.ts`
   - Creator npub: `npub17w98lrsg36nj0cckhxgd52wdlrgnx544lgy4jsg3fwpla7jtvlaqgjdrc6`
   - Episode kind: 30054 (addressable)
   - Uses Nostrify library for Nostr operations

2. **Episode Publishing**: `/home/shepherd/Nextcloud/Projects/lab/podstr/src/hooks/usePublishEpisode.ts`
   - Creates kind 30054 events with required tags
   - Uses `useNostrPublish` hook for signing and publishing
   - Supports multiple media types and OP3 prefixing

3. **RSS Generation**: `/home/shepherd/Nextcloud/Projects/lab/podstr/scripts/build-rss.ts`
   - Fetches episodes from multiple relays
   - Generates RSS feed with Podcasting 2.0 tags
   - Deduplicates events by `d` tag identifier

4. **NIP-53 Livestream Structure** (from NIP-53):
   - Kind: 30311 (addressable event - 30000-39999 range)
   - Required tags: `d` (identifier), `title`, `summary` (description)
   - Media tags: `streaming` (URL), `recording` (URL), `starts`, `ends`, `t` (hashtags)
   - Status tags: `planned`, `live`, `ended`, `cancelled`
   - Participants: `p` tags with roles (Host/Speaker/Participant) and optional proof field
   - Content: Usually empty, may contain additional metadata

## Implementation Strategy

### 1. GitHub Actions Workflow Structure

**File**: `.github/workflows/livestream-to-episode.yml`

```yaml
name: Convert Livestreams to Episodes

on:
  # Manual trigger
  workflow_dispatch:
    inputs:
      batch_mode:
        description: 'Batch multiple livestreams into one episode'
        required: false
        default: 'false'
        type: boolean
      livestream_ids:
        description: 'Comma-separated livestream d-tag identifiers (optional, for manual selection)'
        required: false
        type: string

  # Scheduled check (every 6 hours)
  schedule:
    - cron: '0 */6 * * *'

jobs:
  convert-livestreams:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pages: write
      id-token: write
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Convert livestreams to episodes
        env:
          NOSTR_PRIVATE_KEY: ${{ secrets.NOSTR_PRIVATE_KEY }}
          LIVESTREAM_AUTHOR_NPUB: ${{ secrets.LIVESTREAM_AUTHOR_NPUB }}
          BATCH_MODE: ${{ github.event.inputs.batch_mode || 'false' }}
          LIVESTREAM_IDS: ${{ github.event.inputs.livestream_ids || '' }}
        run: |
          npx -y tsx scripts/convert-livestreams-to-episodes.ts \
            --batch-mode="${BATCH_MODE}" \
            --livestream-ids="${LIVESTREAM_IDS}"

      - name: Generate RSS feed
        run: npx -y tsx scripts/build-rss.ts

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload RSS artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist/rss.xml

      - name: Deploy to GitHub Pages
        uses: actions/deploy-pages@v4
        id: deployment
```

### 2. Nostr Query Strategy

**Target**: `npub17w98lrsg36nj0cckhxgd52wdlrgnx544lgy4jsg3fwpla7jtvlaqgjdrc6`

**Query Parameters**:
- Kind: 30311 (livestreams)
- Authors: Target npub (decoded to hex)
- Limit: 100 (recent livestreams)
- Since: Last run timestamp (from state file)

**Relay Strategy** (same as `build-rss.ts`):
- `wss://relay.primal.net`
- `wss://relay.nostr.band`
- `wss://relay.damus.io`
- `wss://nos.lol`
- `wss://relay.ditto.pub`

### 3. Association Strategy

**Option A: Episode tags referencing livestreams** (Recommended)

```typescript
// In episode event (kind 30054)
tags.push(['livestream', '30311:${livestream.pubkey}:${livestream_d_tag}']);
```

**Benefits**:
- Episodes are source of truth
- Easy to query original livestream metadata
- Clear relationship tracking

### 4. Duplicate Prevention Mechanism

**Strategy**: Check for existing episode associations before creating new ones

```typescript
// Check if livestream already converted
function isLivestreamConverted(livestream: NostrEvent, existingEpisodes: NostrEvent[]): boolean {
  // Method 1: Check for livestream tags in episodes
  return existingEpisodes.some(ep =>
    ep.tags.some(tag =>
      tag[0] === 'livestream' &&
      tag[1] === `30311:${livestream.pubkey}:${livestream.tags.find(t => t[0] === 'd')?.[1]}`
  );
}
```

### 5. Conversion Logic

**Validation Rules**:

```typescript
function shouldSkipLivestream(livestream: NostrEvent): { skip: boolean, reason?: string } {
  const status = livestream.tags.find(([name]) => name === 'status')?.[1];

  if (status === 'cancelled') {
    return { skip: true, reason: 'Stream was cancelled' };
  }

  const starts = livestream.tags.find(([name]) => name === 'starts')?.[1];
  if (status === 'planned' && starts && parseInt(starts) > Date.now() / 1000) {
    return { skip: true, reason: 'Stream is scheduled for future' };
  }

  return { skip: false };
}
```

**Extract Shoshou Recording**:

```typescript
function extractRecordingUrl(livestream: NostrEvent): string | null {
  // Priority 1: Use 'recording' tag (Shoshou recording)
  const recording = livestream.tags.find(([name]) => name === 'recording')?.[1];
  if (recording) {
    return recording;
  }

  // Priority 2: Use 'streaming' tag (original stream, not ideal)
  const streaming = livestream.tags.find(([name]) => name === 'streaming')?.[1];
  if (streaming) {
    console.warn('⚠️ Using streaming URL instead of recording (quality may be poor)');
    return streaming;
  }

  console.error('❌ No recording or streaming URL found');
  return null;
}
```

**Batch Mode Grouping**:

```typescript
// Group livestreams by day for batch episodes
function groupLivestreamsForBatch(livestreams: NostrEvent[]): NostrEvent[][] {
  const byDay = new Map<string, NostrEvent[]>();

  livestreams.forEach(stream => {
    const date = new Date(stream.created_at * 1000).toDateString();
    if (!byDay.has(date)) {
      byDay.set(date, []);
    }
    byDay.get(date)!.push(stream);
  });

  return Array.from(byDay.values());
}
```

### 6. RSS Generation Integration

**Trigger**: After successful episode creation, run `scripts/build-rss.ts`

**Implementation**: The existing RSS generation script already:
- Fetches all kind 30054 episodes from Nostr
- Generates RSS feed with Podcasting 2.0 tags
- Deploys to GitHub Pages

**No changes needed to `build-rss.ts`** - it will automatically pick up new episodes.

## Files to Create

### 1. `.github/workflows/livestream-to-episode.yml`
**Purpose**: GitHub Actions workflow definition
**Content**: Workflow triggers, job steps, environment variables

### 2. `scripts/convert-livestreams-to-episodes.ts`
**Purpose**: Main conversion script (~500-600 lines)
**Functions**:
- `main()`: Entry point, orchestrates conversion
- `fetchLivestreams()`: Query kind 30311 events
- `fetchExistingEpisodes()`: Query kind 30054 for duplicate detection
- `shouldSkipLivestream()`: Validation logic
- `extractRecordingUrl()`: Extract media URL from download tags
- `isLivestreamConverted()`: Duplicate detection
- `groupLivestreamsForBatch()`: Group livestreams by day
- `livestreamToEpisodeData()`: Map livestream metadata to episode format
- `batchConvertLivestreams()`: Create batch episodes
- `signAndPublishEvent()`: Publish to Nostr
- `saveConversionState()`: Persist state
- `logConversionSummary()`: Report results

### 3. `scripts/lib/conversion-types.ts` (optional)
**Purpose**: TypeScript types for conversion
**Content**:
```typescript
interface LivestreamConversionConfig {
  batchMode: boolean;
  livestreamIds?: string[];
  nostrPrivateKey: string;
  targetNpub: string;
}

interface ConversionState {
  lastProcessedTimestamp: number;
  processedLivestreams: Record<string, {
    address: string;
    timestamp: number;
    episodeId?: string;
    status: 'success' | 'failed' | 'skipped';
  }>;
}

interface ConversionResult {
  totalLivestreams: number;
  converted: number;
  skipped: number;
  failed: number;
  livestreams: LivestreamConversionSummary[];
}

interface LivestreamConversionSummary {
  livestreamAddress: string;
  title: string;
  episodeId: string;
  status: 'success' | 'failed' | 'skipped';
  reason?: string;
}
```

### 4. `scripts/lib/conversion-state.ts` (optional)
**Purpose**: State persistence and loading
**Content**:
```typescript
import { promises as fs } from 'fs';
import path from 'path';

const STATE_FILE = '.github/conversion-state.json';

interface ConversionState {
  lastProcessedTimestamp: number;
  processedLivestreams: Record<string, ConversionLivestreamInfo>;
}

export async function loadConversionState(): Promise<ConversionState> {
  try {
    const content = await fs.readFile(STATE_FILE, 'utf-8');
    return JSON.parse(content) as ConversionState;
  } catch (error) {
    console.log('No state file found, using default');
    return {
      lastProcessedTimestamp: 0,
      processedLivestreams: {}
    };
  }
}

export async function saveConversionState(state: ConversionState): Promise<void> {
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}
```

### 5. `scripts/lib/conversion-utils.ts` (optional)
**Purpose**: Shared utility functions
**Content**:
```typescript
import { NostrEvent } from '@nostrify/nostrify';

export function extractRecordingUrl(livestream: NostrEvent): string | null { /* ... */ }
export function shouldSkipLivestream(livestream: NostrEvent): { skip: boolean, reason?: string } { /* ... */ }
export function isLivestreamConverted(livestream: NostrEvent, existingEpisodes: NostrEvent[]): boolean { /* ... */ }
export function formatLogMessage(level: string, message: string, data?: any): string { /* ... */ }
export async function saveConversionState(state: any): Promise<void> { /* ... */ }
export async function loadConversionState(): Promise<any> { /* ... */ }
```

## Files to Modify

### 1. `package.json`
**Change**: Add new scripts
```json
{
  "scripts": {
    "convert-livestreams-to-episodes": "tsx scripts/convert-livestreams-to-episodes.ts",
    "convert-livestreams-to-episodes:batch": "tsx scripts/convert-livestreams-to-episodes.ts --batch-mode=true"
  }
}
```

### 2. `.gitignore`
**Change**: Ignore state files
```
.github/conversion-state.json
conversion-state.json
```

## Environment Variables Required

### GitHub Secrets:
1. `NOSTR_PRIVATE_KEY`: Private key (nsec format) for signing events
2. `LIVESTREAM_AUTHOR_NPUB`: Target npub (already known: `npub17w98lrsg36nj0cckhxgd52wdlrgnx544lgy4jsg3fwpla7jtvlaqgjdrc6`)

### Optional Configuration:
- `CONVERSION_BATCH_MODE`: Default batch mode setting
- `RELAY_TIMEOUT`: Query timeout in milliseconds
- `MAX_LIVESTREAMS_PER_RUN`: Limit on conversions per run

## Implementation Steps

### Phase 1: Core Conversion Script
1. Create `scripts/convert-livestreams-to-episodes.ts`
2. Implement livestream fetching from Nostr
3. Implement validation and filtering logic
4. Implement episode creation logic
5. Implement duplicate detection
6. Add error handling and logging

### Phase 2: Batch Mode
1. Implement grouping logic for multiple livestreams
2. Add batch episode creation
3. Update episode tags to reference multiple livestreams
4. Test batch conversion scenarios

### Phase 3: GitHub Actions Integration
1. Create `.github/workflows/livestream-to-episode.yml`
2. Configure triggers (manual + scheduled)
3. Add environment variable configuration
4. Add RSS generation step
5. Add deployment step

### Phase 4: State Management
1. Implement conversion state persistence
2. Add state loading at startup
3. Add state saving after conversions
4. Add state cleanup logic (old entries)

### Phase 5: Testing
1. Test single livestream conversion
2. Test cancelled stream skipping
3. Test duplicate prevention
4. Test batch mode
5. Test RSS integration
6. Test GitHub Actions workflow

## Detailed Implementation Notes

### Nostr Event Signing in Node.js

The script will need to sign events server-side. Options:

**Option A: Use NSecSigner from Nostrify** (Recommended)
```typescript
import { NSecSigner } from '@nostrify/nostrify';

const signer = new NSecSigner(process.env.NOSTR_PRIVATE_KEY!);
const event = await signer.signEvent({
  kind: 30054,
  content: '',
  tags: [...]
});
```

**Option B: Use nostr-tools**
```typescript
import { generatePrivateKey, getPublicKey, finalizeEvent } from 'nostr-tools';

// Use private key from env
const privateKey = process.env.NOSTR_PRIVATE_KEY!;
const event = finalizeEvent({
  kind: 30054,
  content: '',
  tags: [...]
}, privateKey);
```

**Recommendation**: Use Nostrify's `NSecSigner` for consistency with codebase.

### NIP-31 Alt Tag Compliance

All created events must include an `alt` tag:
```typescript
tags.push(['alt', `Podcast episode: ${title}`]);
```

### NIP-19 Identifier Encoding

When creating episodes, ensure proper `d` tag format:
```typescript
// Single mode: use livestream's d tag
const dTag = livestream.tags.find(([name]) => name === 'd')?.[1] || `episode-${Date.now()}`;

// Batch mode: create new identifier
const dTag = `batch-livestreams-${Date.now()}`;
```

### RSS Feed Update

After successful conversion, trigger RSS generation:
```typescript
// In workflow, after conversion step
- name: Generate RSS feed
  run: npx -y tsx scripts/build-rss.ts
```

The existing `build-rss.ts` will automatically:
- Fetch all episodes (including newly created ones)
- Generate RSS feed with proper Podcasting 2.0 tags
- Deploy to GitHub Pages

## Edge Cases and Considerations

### 1. Missing Recording URL
- **Problem**: Livestream has no `recording` tag
- **Solution**: Skip with warning, log for manual review

### 2. Invalid Recording URL
- **Problem**: Recording URL is not accessible
- **Solution**: Add URL validation, skip if unreachable

### 3. Duplicate Livestream References
- **Problem**: Same livestream processed multiple times
- **Solution**: State persistence with address tracking

### 4. Episode Title Conflicts
- **Problem**: Multiple livestreams have same title
- **Solution**: Append timestamp or sequence number

### 5. Large Batch Conversions
- **Problem**: Too many livestreams in one batch
- **Solution**: Limit to reasonable number (e.g., 10 per episode)

### 6. Relay Failures
- **Problem**: Relays return partial or no data
- **Solution**: Multi-relay query with partial result handling

### 7. Network Timeouts
- **Problem**: Long-running queries timeout
- **Solution**: Per-relay timeouts with exponential backoff

## Success Criteria

1. ✅ Workflow runs successfully on manual trigger
2. ✅ Workflow runs successfully on schedule (every 6 hours)
3. ✅ Cancelled livestreams are skipped with logging
4. ✅ Only livestreams with recording URLs are converted
5. ✅ Duplicate livestreams are not reprocessed
6. ✅ Episodes include proper association tags
7. ✅ RSS feed updates automatically after conversion
8. ✅ Conversion state persists between runs
9. ✅ Batch mode creates single episode from multiple streams
10. ✅ Errors are logged and handled gracefully

---

### Critical Files for Implementation

- **/home/shepherd/Nextcloud/Projects/lab/podstr/.github/workflows/livestream-to-episode.yml** - GitHub Actions workflow
- **/home/shepherd/Nextcloud/Projects/lab/podstr/scripts/convert-livestreams-to-episodes.ts** - Main conversion script
- **/home/shepherd/Nextcloud/Projects/lab/podstr/src/lib/conversion-types.ts** - TypeScript types for conversion
- **/home/shepherd/Nextcloud/Projects/lab/podstr/scripts/lib/conversion-state.ts** - State persistence
- **/home/shepherd/Nextcloud/Projects/lab/podstr/scripts/lib/conversion-utils.ts** - Utility functions
- **/home/shepherd/Nextcloud/Projects/lab/podstr/package.json** - Add script entries

---

*Created: 2026-03-09*
*Author: Claude Sonnet 4.6*
*Context: Automatic livestream-to-podcast conversion with RSS integration
