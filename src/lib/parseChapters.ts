import type { PodcastChapter } from '@/types/podcast';

/** Regex to match timestamp lines: MM:SS, H:MM:SS, or HH:MM:SS with optional separator before title */
const TIMESTAMP_RE = /^\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–—]?\s*(.+)$/;

/** Convert a timestamp string to seconds */
function timestampToSeconds(ts: string): number {
  const parts = ts.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return parts[0] * 60 + parts[1];
}

/** Parse timestamp lines from episode content into chapters */
export function parseChaptersFromContent(content: string): PodcastChapter[] {
  const chapters: PodcastChapter[] = [];

  for (const line of content.split('\n')) {
    const match = line.match(TIMESTAMP_RE);
    if (match) {
      chapters.push({
        startTime: timestampToSeconds(match[1]),
        title: match[2].trim(),
      });
    }
  }

  // Require at least 2 chapters to avoid false positives
  if (chapters.length < 2) {
    return [];
  }

  // Sort by startTime ascending
  chapters.sort((a, b) => a.startTime - b.startTime);

  return chapters;
}

/** Generate Podcasting 2.0 JSON chapters string */
export function generateChaptersJSON(chapters: PodcastChapter[]): string {
  return JSON.stringify({
    version: '1.2.0',
    chapters: chapters.map(({ startTime, title }) => ({ startTime, title })),
  }, null, 2);
}
