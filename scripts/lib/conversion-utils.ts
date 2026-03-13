import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'child_process';
import { NSecSigner } from '@nostrify/nostrify';
import { BlossomUploader } from '@nostrify/nostrify/uploaders';
import { NSyteBunkerSigner } from './nsyte-bunker-minimal';
import type { NostrEvent } from '@nostrify/nostrify';

export function extractRecordingUrl(livestream: NostrEvent): string | null {
  const download = livestream.tags.find(([name]) => name === 'download')?.[1];
  if (download) {
    console.log('✅ Found download tag (Shoshou recording):', download);
    return download;
  }

  const recording = livestream.tags.find(([name]) => name === 'recording')?.[1];
  if (recording) {
    console.log('✅ Found recording tag:', recording);
    return recording;
  }

  const streaming = livestream.tags.find(([name]) => name === 'streaming')?.[1];
  if (streaming) {
    console.warn('⚠️  Using streaming URL instead of recording (quality may be poor):', streaming);
    return streaming;
  }

  console.error('❌ No download, recording, or streaming URL found');
  return null;
}

export function shouldSkipLivestream(livestream: NostrEvent): { skip: boolean, reason?: string } {
  const status = livestream.tags.find(([name]) => name === 'status')?.[1];

  if (status === 'cancelled') {
    const dTag = livestream.tags.find(([name]) => name === 'd')?.[1];
    console.log(`⏭️  Skipping cancelled livestream: ${dTag}`);
    return { skip: true, reason: 'Stream was cancelled' };
  }

  const starts = livestream.tags.find(([name]) => name === 'starts')?.[1];
  if (status === 'planned' && starts && parseInt(starts) > Date.now() / 1000) {
    const dTag = livestream.tags.find(([name]) => name === 'd')?.[1];
    console.log(`⏭️  Skipping future livestream: ${dTag}`);
    return { skip: true, reason: 'Stream is scheduled for future' };
  }

  return { skip: false };
}

export function isLivestreamConverted(livestream: NostrEvent, existingEpisodes: NostrEvent[]): boolean {
  const dTag = livestream.tags.find(([name]) => name === 'd')?.[1];
  if (!dTag) return false;

  return existingEpisodes.some(ep => {
    const livestreamTag = ep.tags.find(([name]) => name === 'livestream');
    if (!livestreamTag) return false;

    return livestreamTag[1] === `30311:${livestream.pubkey}:${dTag}`;
  });
}

export function groupLivestreamsForBatch(livestreams: NostrEvent[]): Record<string, NostrEvent[]> {
  const byHour: Record<string, NostrEvent[]> = {};

  livestreams.forEach(stream => {
    // Get starts timestamp from livestream, fallback to created_at
    const starts = stream.tags.find(([name]) => name === 'starts')?.[1];
    const timestamp = starts ? parseInt(starts) : stream.created_at;
    const date = new Date(timestamp * 1000);

    // Group by year-month-day-hour
    const hourKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}`;

    if (!byHour[hourKey]) {
      byHour[hourKey] = [];
    }
    byHour[hourKey].push(stream);
  });

  return byHour;
}

export async function combineAudioFiles(audioUrls: string[], outputFilename: string): Promise<string> {
  console.log(`🎵 Combining ${audioUrls.length} audio files...`);

  // Create temp directory
  const tempDir = path.join(process.cwd(), '.temp-audio');
  await fs.mkdir(tempDir, { recursive: true });

  // Download audio files
  const audioFiles: string[] = [];
  for (let i = 0; i < audioUrls.length; i++) {
    const url = audioUrls[i];
    const filename = `audio-${i}.mp3`;
    const filepath = path.join(tempDir, filename);

    console.log(`📥 Downloading: ${url}`);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download audio: ${response.statusText} (${response.status})`);
      }

      const buffer = await response.arrayBuffer();
      await fs.writeFile(filepath, Buffer.from(buffer));
      audioFiles.push(filepath);
      console.log(`✅ Downloaded: ${filepath}`);
    } catch (error) {
      console.error(`❌ Failed to download audio from ${url}:`, error);
      throw error;
    }
  }

  // Create input list file for ffmpeg
  const listFilePath = path.join(tempDir, 'concat-list.txt');
  const listContent = audioFiles.map(f => `file '${f}'`).join('\n');
  await fs.writeFile(listFilePath, listContent);

  // Combine audio using ffmpeg
  const outputPath = path.join(tempDir, outputFilename);
  const ffmpegCmd = `ffmpeg -f concat -safe 0 -i "${listFilePath}" -c copy "${outputPath}"`;

  console.log(`🎬 Running ffmpeg...`);
  await new Promise<void>((resolve, reject) => {
    exec(ffmpegCmd, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ FFmpeg error:', stderr);
        reject(error);
      } else {
        console.log('✅ FFmpeg output:', stdout.trim());
        resolve();
      }
    });
  });

  console.log(`✅ Combined audio saved to: ${outputPath}`);

  return outputPath;
}

export async function uploadCombinedAudio(filepath: string, privateKey: string | undefined, nbunksec?: string): Promise<string> {
  console.log('☁️  Uploading combined audio to Blossom...');

  // Read file
  const fileBuffer = await fs.readFile(filepath);
  const file = new File([fileBuffer], path.basename(filepath), {
    type: 'audio/mpeg'
  });

  // Create signer
  let signer;
  if (nbunksec) {
    console.log('🔐 Using nsyte bunker for remote signing');
    const [bunkerUrl, _rest] = nbunksec.split('?');
    signer = new NSyteBunkerSigner(bunkerUrl, nbunksec);
  } else {
    if (!privateKey) {
      throw new Error('Private key is required when not using nbunksec');
    }
    console.log('🔐 Using local NSecSigner');
    signer = new NSecSigner(privateKey);
  }

  // Upload to Blossom
  const uploader = new BlossomUploader({
    servers: [
      'https://nostr.download',
      'https://blossom.band'
    ],
    signer,
    expiresIn: 1_800_000, // 30 minutes
  });

  try {
    const tags = await uploader.upload(file);
    const [[_, url]] = tags; // First tag is URL

    console.log(`✅ Upload successful: ${url}`);

    // Cleanup temp files
    await fs.rm(path.dirname(filepath), { recursive: true, force: true });
    console.log('🧹 Cleaned up temp audio files');

    return url;
  } catch (error) {
    console.error('❌ Blossom upload failed:', error);
    throw new Error(`Blossom upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function createSigner(privateKey: string | undefined, nbunksec?: string) {
  if (nbunksec) {
    console.log('🔐 Using nsyte bunker for remote signing');
    const [bunkerUrl, _rest] = nbunksec.split('?');
    return new NSyteBunkerSigner(bunkerUrl, nbunksec);
  }
  if (!privateKey) {
    throw new Error('Private key is required when not using nbunksec');
  }
  console.log('🔐 Using local NSecSigner');
  return new NSecSigner(privateKey);
}
