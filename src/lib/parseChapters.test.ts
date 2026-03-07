import { describe, it, expect } from 'vitest';
import { parseChaptersFromContent, generateChaptersJSON } from './parseChapters';

describe('parseChaptersFromContent', () => {
  it('parses MM:SS format', () => {
    const content = `CHAPTERS
00:00 Intro
00:15 Welcome to Soapbox Sessions
01:00 Derek's Nashville Travel Recap`;

    const chapters = parseChaptersFromContent(content);
    expect(chapters).toEqual([
      { startTime: 0, title: 'Intro' },
      { startTime: 15, title: 'Welcome to Soapbox Sessions' },
      { startTime: 60, title: "Derek's Nashville Travel Recap" },
    ]);
  });

  it('parses H:MM:SS format', () => {
    const content = `CHAPTERS
00:00 Rebuilding the Internet: A New Perspective
08:58 Upcoming Events in the Decentralized Space
1:00:12 Wrap Up`;

    const chapters = parseChaptersFromContent(content);
    expect(chapters).toEqual([
      { startTime: 0, title: 'Rebuilding the Internet: A New Perspective' },
      { startTime: 538, title: 'Upcoming Events in the Decentralized Space' },
      { startTime: 3612, title: 'Wrap Up' },
    ]);
  });

  it('parses HH:MM:SS format', () => {
    const content = `### Timestamps

00:00 Nostr Development Updates
00:19 rust-nostr Ships Major API Redesign
01:45:35 Outro`;

    const chapters = parseChaptersFromContent(content);
    expect(chapters).toEqual([
      { startTime: 0, title: 'Nostr Development Updates' },
      { startTime: 19, title: 'rust-nostr Ships Major API Redesign' },
      { startTime: 6335, title: 'Outro' },
    ]);
  });

  it('parses dash-separated format', () => {
    const content = `00:00 - Introduction to Nostr Compass Episode 5
01:01 - BitChat Security Audit Insights: Cure53 findings and 17+ PRs
53:04 - Conclusion and Future Developments`;

    const chapters = parseChaptersFromContent(content);
    expect(chapters).toEqual([
      { startTime: 0, title: 'Introduction to Nostr Compass Episode 5' },
      { startTime: 61, title: 'BitChat Security Audit Insights: Cure53 findings and 17+ PRs' },
      { startTime: 3184, title: 'Conclusion and Future Developments' },
    ]);
  });

  it('handles em dash and en dash separators', () => {
    const content = `00:00 – Intro with en dash
05:30 — Middle with em dash`;

    const chapters = parseChaptersFromContent(content);
    expect(chapters).toEqual([
      { startTime: 0, title: 'Intro with en dash' },
      { startTime: 330, title: 'Middle with em dash' },
    ]);
  });

  it('ignores non-timestamp lines and headers', () => {
    const content = `This is the show notes for an episode.

Chapters:
  00:00 Intro
  00:15 Welcome

Check us out at example.com`;

    const chapters = parseChaptersFromContent(content);
    expect(chapters).toEqual([
      { startTime: 0, title: 'Intro' },
      { startTime: 15, title: 'Welcome' },
    ]);
  });

  it('returns empty array for fewer than 2 chapters', () => {
    const content = `Just a single timestamp: 00:00 Intro`;
    expect(parseChaptersFromContent(content)).toEqual([]);
  });

  it('returns empty array for no timestamps', () => {
    const content = 'Just some episode notes with no timestamps at all.';
    expect(parseChaptersFromContent(content)).toEqual([]);
  });

  it('sorts chapters by startTime', () => {
    const content = `05:00 Middle
00:00 Start
10:00 End`;

    const chapters = parseChaptersFromContent(content);
    expect(chapters[0].startTime).toBe(0);
    expect(chapters[1].startTime).toBe(300);
    expect(chapters[2].startTime).toBe(600);
  });

  it('handles titles with colons', () => {
    const content = `00:00 Topic: Subtopic
05:00 Another: One: Here`;

    const chapters = parseChaptersFromContent(content);
    expect(chapters[0].title).toBe('Topic: Subtopic');
    expect(chapters[1].title).toBe('Another: One: Here');
  });
});

describe('generateChaptersJSON', () => {
  it('generates valid Podcasting 2.0 JSON', () => {
    const chapters = [
      { startTime: 0, title: 'Intro' },
      { startTime: 538, title: 'Upcoming Events' },
    ];

    const json = generateChaptersJSON(chapters);
    const parsed = JSON.parse(json);

    expect(parsed.version).toBe('1.2.0');
    expect(parsed.chapters).toEqual([
      { startTime: 0, title: 'Intro' },
      { startTime: 538, title: 'Upcoming Events' },
    ]);
  });

  it('strips extra fields like img and url', () => {
    const chapters = [
      { startTime: 0, title: 'Intro', img: 'http://example.com/img.jpg', url: 'http://example.com' },
      { startTime: 60, title: 'End' },
    ];

    const json = generateChaptersJSON(chapters);
    const parsed = JSON.parse(json);

    expect(parsed.chapters[0]).toEqual({ startTime: 0, title: 'Intro' });
    expect(parsed.chapters[1]).toEqual({ startTime: 60, title: 'End' });
  });
});
