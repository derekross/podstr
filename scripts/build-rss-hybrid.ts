import { promises as fs } from 'fs';
import path from 'path';
import { PODCAST_CONFIG } from '../src/lib/podcastConfig.js';

/**
 * Episode data structure
 */
interface EpisodeData {
  url?: string;
  audioUrl?: string;
  pubDate?: string;
  createdAt?: number | string;
  duration?: number;
  imageUrl?: string;
  image?: string;
  description?: string;
  content?: string;
  identifier?: string;
  d?: string;
  size?: number;
  audioSize?: number;
  explicit?: boolean;
  type?: string;
  episodeNumber?: number;
  season?: number;
  title: string;
}

/**
 * Escape XML special characters
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Format duration in seconds to HH:MM:SS format for iTunes RSS
 */
function formatDurationForRSS(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

/**
 * Generate episode item XML
 */
function generateEpisodeItemXML(episode: EpisodeData): string {
  const audioUrl = episode.url || episode.audioUrl;
  const pubDate = episode.pubDate || new Date(episode.createdAt || Date.now()).toUTCString();
  const duration = episode.duration ? formatDurationForRSS(episode.duration) : '00:00';
  const imageUrl = episode.imageUrl || episode.image || PODCAST_CONFIG.podcast.image;

  return `
    <item>
      <title>${escapeXml(episode.title)}</title>
      <description>${escapeXml(episode.description || episode.content || '')}</description>
      <link>${escapeXml(audioUrl)}</link>
      <guid isPermaLink="false">${escapeXml(episode.identifier || episode.d || audioUrl)}</guid>
      <pubDate>${escapeXml(pubDate)}</pubDate>
      <enclosure url="${escapeXml(audioUrl)}" type="audio/mpeg" length="${episode.size || episode.audioSize || 0}" />
      <itunes:author>${escapeXml(PODCAST_CONFIG.podcast.author)}</itunes:author>
      <itunes:subtitle>${escapeXml(episode.description || episode.content || '').split('\n')[0]}</itunes:subtitle>
      <itunes:summary>${escapeXml(episode.description || episode.content || '')}</itunes:summary>
      <itunes:image href="${escapeXml(imageUrl)}" />
      <itunes:duration>${duration}</itunes:duration>
      <itunes:explicit>${episode.explicit || PODCAST_CONFIG.podcast.explicit ? 'yes' : 'no'}</itunes:explicit>
      <itunes:episodeType>${episode.type || PODCAST_CONFIG.podcast.type}</itunes:episodeType>
      ${episode.episodeNumber ? `<itunes:episode>${episode.episodeNumber}</itunes:episode>` : ''}
      ${episode.season ? `<itunes:season>${episode.season}</itunes:season>` : ''}
      <category>${escapeXml(PODCAST_CONFIG.podcast.categories[0] || 'Technology')}</category>
    </item>`;
}

/**
 * Hybrid RSS feed generator that can include hardcoded episodes
 * This works without WebSocket/Nostr queries by reading from a local episodes file
 */
async function buildHybridRSS() {
  console.log('🏗️  Building hybrid RSS feed...');

  try {
    const config = PODCAST_CONFIG.podcast;
    const baseUrl = config.website || 'https://kurt-croix.github.io/podstr';

    // Try to read episodes from a local file
    let episodes: EpisodeData[] = [];
    try {
      const episodesPath = path.resolve('episodes.json');
      const episodesContent = await fs.readFile(episodesPath, 'utf-8');
      episodes = JSON.parse(episodesContent);
      console.log(`📊 Loaded ${episodes.length} episodes from episodes.json`);
    } catch {
      console.log('📄 No episodes.json file found, RSS feed will have 0 episodes');
      console.log('💡 Tip: Create episodes.json with episode data to include episodes in RSS feed');
    }

    // Generate RSS content
    const items = episodes.map(episode => generateEpisodeItemXML(episode)).join('');

    const rssContent = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:podcast="https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md">
  <channel>
    <title>${escapeXml(config.title)}</title>
    <description>${escapeXml(config.description)}</description>
    <link>${escapeXml(baseUrl)}</link>
    <language>${escapeXml(config.language)}</language>
    <copyright>${escapeXml(config.copyright)}</copyright>
    <managingEditor>${escapeXml(config.email)} (${escapeXml(config.author)})</managingEditor>
    <webMaster>${escapeXml(config.email)} (${escapeXml(config.author)})</webMaster>
    <pubDate>${new Date().toUTCString()}</pubDate>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <ttl>${PODCAST_CONFIG.rss.ttl}</ttl>

    <!-- iTunes/Apple Podcasts tags -->
    <itunes:title>${escapeXml(config.title)}</itunes:title>
    <itunes:summary>${escapeXml(config.description)}</itunes:summary>
    <itunes:author>${escapeXml(config.author)}</itunes:author>
    <itunes:owner>
      <itunes:name>${escapeXml(config.author)}</itunes:name>
      <itunes:email>${escapeXml(config.email)}</itunes:email>
    </itunes:owner>
    <itunes:image href="${escapeXml(config.image)}" />
    <itunes:category text="${escapeXml(config.categories[0] || 'Technology')}" />
    <itunes:explicit>${config.explicit ? 'yes' : 'no'}</itunes:explicit>
    <itunes:type>${escapeXml(config.type)}</itunes:type>

    <!-- Podcasting 2.0 tags -->
    <podcast:guid>${escapeXml(config.guid)}</podcast:guid>
    <podcast:medium>${escapeXml(config.medium)}</podcast:medium>
    <podcast:value type="lightning" method="${escapeXml(config.value.currency)}">${config.value.amount}</podcast:value>
    ${config.value.recipients.map(rec => `
    <podcast:valueRecipient type="${escapeXml(rec.type)}">${escapeXml(rec.address)}</podcast:valueRecipient>
    <podcast:valueRecipient name="${escapeXml(rec.name)}" split="${rec.split}"${rec.fee ? ' fee="true"' : ''} />
    `).join('')}

    <!-- Person tags -->
    ${config.person.map(p => `
    <podcast:person role="${escapeXml(p.role)}" group="${escapeXml(p.group)}">${escapeXml(p.name)}</podcast:person>
    `).join('')}

    <!-- License -->
    <podcast:license>${escapeXml(config.license.identifier)}${config.license.url ? ` url="${escapeXml(config.license.url)}"` : ''}</podcast:license>

    <!-- Episodes -->
    ${items}

    <!-- Note: Episodes loaded from episodes.json file -->
    <!-- To add episodes, create episodes.json with episode data -->
  </channel>
</rss>`;

    // Ensure dist directory exists
    const distDir = path.resolve('dist');
    await fs.mkdir(distDir, { recursive: true });

    // Write RSS file
    const rssPath = path.join(distDir, 'rss.xml');
    await fs.writeFile(rssPath, rssContent, 'utf-8');

    console.log(`✅ Hybrid RSS feed generated at: ${rssPath}`);
    console.log(`📊 Feed size: ${(rssContent.length / 1024).toFixed(2)} KB`);
    console.log(`📊 Episodes included: ${episodes.length}`);

    // Write health check file
    const healthPath = path.join(distDir, 'rss-health.json');
    const healthData = {
      status: 'ok',
      endpoint: '/rss.xml',
      generatedAt: new Date().toISOString(),
      episodeCount: episodes.length,
      feedSize: rssContent.length,
      environment: 'production',
      accessible: true,
      dataSource: 'episodes.json',
      message: episodes.length > 0
        ? 'RSS feed includes episodes from episodes.json'
        : 'No episodes found. Create episodes.json to add episodes to RSS feed.'
    };
    await fs.writeFile(healthPath, JSON.stringify(healthData, null, 2));

    console.log(`✅ Health check file generated at: ${healthPath}`);

    // Add .nojekyll file for GitHub Pages compatibility
    const nojekyllPath = path.join(distDir, '.nojekyll');
    await fs.writeFile(nojekyllPath, '', 'utf-8');

    console.log('✅ .nojekyll file added for GitHub Pages compatibility');

    // Create sample episodes.json if it doesn't exist
    const episodesPath = path.resolve('episodes.json');
    try {
      await fs.access(episodesPath);
    } catch {
      console.log('📄 Creating sample episodes.json file...');
      const sampleEpisodes = [
        {
          title: 'Sample Episode',
          description: 'This is a sample episode. Replace this with your actual episode data.',
          identifier: 'sample-1',
          url: 'https://example.com/sample.mp3',
          duration: 1800,
          episodeNumber: 1,
          explicit: false,
          type: 'full',
          createdAt: new Date().toISOString(),
          size: 1000000
        }
      ];
      await fs.writeFile(episodesPath, JSON.stringify(sampleEpisodes, null, 2), 'utf-8');
      console.log('✅ Sample episodes.json created. Edit it to add your actual episodes.');
    }

  } catch (error) {
    console.error('❌ Error building RSS feed:', error);
    throw error;
  }
}

// Build RSS feed
buildHybridRSS().catch(error => {
  console.error('Failed to build RSS feed:', error);
  process.exit(1);
});
