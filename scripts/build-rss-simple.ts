import { promises as fs } from 'fs';
import path from 'path';
import { PODCAST_CONFIG } from '../src/lib/podcastConfig.js';

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
 * Simple RSS feed generator for GitHub Pages
 * Generates a basic RSS feed using podcast config without Nostr queries
 */
function generateSimpleRSSFeed(): string {
  const config = PODCAST_CONFIG.podcast;
  const baseUrl = config.website || 'https://kurt-croix.github.io/podstr/';

  return `<?xml version="1.0" encoding="UTF-8"?>
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
    <itunes:category text="${escapeXml(config.categories[0] || 'Society & Culture')}" />
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

    <!-- Note: Episodes will appear here once published to Nostr -->
    <!-- This is a basic RSS feed generated from podcast configuration -->
    <!-- Full episode support requires Nostr relay queries -->
  </channel>
</rss>`;
}

/**
 * Build simple RSS feed for GitHub Pages
 */
async function buildSimpleRSS() {
  console.log('🏗️  Building simple RSS feed for GitHub Pages...');

  try {
    // Generate RSS content from config
    const rssContent = generateSimpleRSSFeed();

    // Ensure dist directory exists
    const distDir = path.resolve('dist');
    await fs.mkdir(distDir, { recursive: true });

    // Write RSS file
    const rssPath = path.join(distDir, 'rss.xml');
    await fs.writeFile(rssPath, rssContent, 'utf-8');

    console.log(`✅ Simple RSS feed generated at: ${rssPath}`);
    console.log(`📊 Feed size: ${(rssContent.length / 1024).toFixed(2)} KB`);

    // Write health check file
    const healthPath = path.join(distDir, 'rss-health.json');
    const healthData = {
      status: 'ok',
      endpoint: '/rss.xml',
      generatedAt: new Date().toISOString(),
      episodeCount: 0,
      feedSize: rssContent.length,
      environment: 'production',
      accessible: true,
      dataSource: 'config-only',
      message: 'Basic RSS feed generated from podcast config. Full episode support requires Nostr relay queries.'
    };
    await fs.writeFile(healthPath, JSON.stringify(healthData, null, 2));

    console.log(`✅ Health check file generated at: ${healthPath}`);

    // Add .nojekyll file for GitHub Pages compatibility
    const nojekyllPath = path.join(distDir, '.nojekyll');
    await fs.writeFile(nojekyllPath, '', 'utf-8');

    console.log('✅ .nojekyll file added for GitHub Pages compatibility');

  } catch (error) {
    console.error('❌ Error building RSS feed:', error);
    throw error;
  }
}

// Build RSS feed
buildSimpleRSS().catch(error => {
  console.error('Failed to build RSS feed:', error);
  process.exit(1);
});
