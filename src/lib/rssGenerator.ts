import type { PodcastEpisode, RSSItem } from '@/types/podcast';
import { PODCAST_CONFIG, type PodcastConfig } from './podcastConfig';
import { encodeEpisodeAsNaddr } from './nip19Utils';


/**
 * Converts a PodcastEpisode to an RSS item
 */
function episodeToRSSItem(episode: PodcastEpisode, config?: PodcastConfig): RSSItem {
  const podcastConfig = config || PODCAST_CONFIG;
  // Get base URL - handle both server and client environments
  const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    // Server-side fallback
    return process.env.BASE_URL || 'https://podstr.example';
  };

  return {
    title: episode.title,
    description: episode.description || '',
    link: `${getBaseUrl()}/${encodeEpisodeAsNaddr(episode.authorPubkey, episode.identifier)}`, // Use naddr links for addressable episodes
    guid: `${episode.authorPubkey}:${episode.identifier}`, // Stable GUID that doesn't change on edits
    pubDate: episode.publishDate.toUTCString(),
    author: `${podcastConfig.podcast.email} (${podcastConfig.podcast.author})`,
    category: episode.tags,
    enclosure: {
      url: episode.audioUrl,
      length: 0, // TODO: We'd need to fetch file size
      type: episode.audioType || 'audio/mpeg'
    },
    duration: episode.duration ? formatDuration(episode.duration) : undefined,
    episodeNumber: episode.episodeNumber,
    seasonNumber: episode.seasonNumber,
    explicit: episode.explicit,
    image: episode.imageUrl,
    transcriptUrl: episode.transcriptUrl,
    chaptersUrl: episode.chaptersUrl,
    // Per-episode value splits (overrides podcast defaults)
    value: episode.value,
  };
}

/**
 * Formats duration from seconds to HH:MM:SS
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Escapes XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generates RSS XML for podcast episodes
 */
export function generateRSSFeed(episodes: PodcastEpisode[], config?: PodcastConfig): string {
  const podcastConfig = config || PODCAST_CONFIG;
  const rssItems = episodes
    .sort((a, b) => b.publishDate.getTime() - a.publishDate.getTime())
    .map(episode => episodeToRSSItem(episode, podcastConfig));

  // Get base URL - handle both server and client environments
  const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    // Server-side fallback
    return process.env.BASE_URL || 'https://podstr.example';
  };

  const baseUrl = getBaseUrl();
  const podcastUrl = baseUrl;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:podcast="https://podcastindex.org/namespace/1.0"
     xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(podcastConfig.podcast.title)}</title>
    <description>${escapeXml(podcastConfig.podcast.description)}</description>
    <link>${escapeXml(podcastConfig.podcast.website || baseUrl)}</link>
    <language>${escapeXml(podcastConfig.podcast.language)}</language>
    <copyright>${escapeXml(podcastConfig.podcast.copyright)}</copyright>
    <managingEditor>${escapeXml(podcastConfig.podcast.email)} (${escapeXml(podcastConfig.podcast.author)})</managingEditor>
    <webMaster>${escapeXml(podcastConfig.podcast.email)} (${escapeXml(podcastConfig.podcast.author)})</webMaster>
    <pubDate>${new Date().toUTCString()}</pubDate>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <ttl>${podcastConfig.rss.ttl}</ttl>

    <!-- iTunes/Apple Podcasts tags -->
    <itunes:title>${escapeXml(podcastConfig.podcast.title)}</itunes:title>
    <itunes:summary>${escapeXml(podcastConfig.podcast.description)}</itunes:summary>
    <itunes:author>${escapeXml(podcastConfig.podcast.author)}</itunes:author>
    <itunes:owner>
      <itunes:name>${escapeXml(podcastConfig.podcast.author)}</itunes:name>
      <itunes:email>${escapeXml(podcastConfig.podcast.email)}</itunes:email>
    </itunes:owner>
    ${podcastConfig.podcast.image ? `<itunes:image href="${escapeXml(podcastConfig.podcast.image)}" />` : ''}
    ${podcastConfig.podcast.categories.map(cat => `<itunes:category text="${escapeXml(cat)}" />`).join('\n    ')}
    <itunes:explicit>${podcastConfig.podcast.explicit ? 'true' : 'false'}</itunes:explicit>
    <itunes:type>${podcastConfig.podcast.type || 'episodic'}</itunes:type>

    <!-- Podcasting 2.0 tags -->
    <podcast:guid>${escapeXml(podcastConfig.podcast.guid || podcastConfig.creatorNpub)}</podcast:guid>
    <podcast:locked>${podcastConfig.podcast.locked ? 'yes' : 'no'}</podcast:locked>
    ${podcastConfig.podcast.medium ? `<podcast:medium>${escapeXml(podcastConfig.podcast.medium)}</podcast:medium>` : ''}
    ${podcastConfig.podcast.publisher ? `<podcast:publisher>${escapeXml(podcastConfig.podcast.publisher)}</podcast:publisher>` : ''}
    ${podcastConfig.podcast.license ?
      `<podcast:license ${podcastConfig.podcast.license.url ? `url="${escapeXml(podcastConfig.podcast.license.url)}"` : ''}>${escapeXml(podcastConfig.podcast.license.identifier)}</podcast:license>` : ''
    }
    ${podcastConfig.podcast.location ?
      `<podcast:location ${podcastConfig.podcast.location.geo ? `geo="${escapeXml(podcastConfig.podcast.location.geo)}"` : ''} ${podcastConfig.podcast.location.osm ? `osm="${escapeXml(podcastConfig.podcast.location.osm)}"` : ''}>${escapeXml(podcastConfig.podcast.location.name)}</podcast:location>` : ''
    }
    ${podcastConfig.podcast.person && podcastConfig.podcast.person.length > 0 ?
      podcastConfig.podcast.person.map(person =>
        `<podcast:person role="${escapeXml(person.role)}" ${person.group ? `group="${escapeXml(person.group)}"` : ''} ${person.img ? `img="${escapeXml(person.img)}"` : ''} ${person.href ? `href="${escapeXml(person.href)}"` : ''}>${escapeXml(person.name)}</podcast:person>`
      ).join('\n    ') : ''
    }
    ${podcastConfig.podcast.txt && podcastConfig.podcast.txt.length > 0 ?
      podcastConfig.podcast.txt.map(txt =>
        `<podcast:txt purpose="${escapeXml(txt.purpose)}">${escapeXml(txt.content)}</podcast:txt>`
      ).join('\n    ') : ''
    }
    ${podcastConfig.podcast.remoteItem && podcastConfig.podcast.remoteItem.length > 0 ?
      podcastConfig.podcast.remoteItem.map(item =>
        `<podcast:remoteItem feedGuid="${escapeXml(item.feedGuid)}" ${item.feedUrl ? `feedUrl="${escapeXml(item.feedUrl)}"` : ''} ${item.itemGuid ? `itemGuid="${escapeXml(item.itemGuid)}"` : ''} ${item.medium ? `medium="${escapeXml(item.medium)}"` : ''} />`
      ).join('\n    ') : ''
    }
    ${podcastConfig.podcast.block ?
      `<podcast:block id="${escapeXml(podcastConfig.podcast.block.id)}" ${podcastConfig.podcast.block.reason ? `reason="${escapeXml(podcastConfig.podcast.block.reason)}"` : ''} />` : ''
    }
    ${podcastConfig.podcast.newFeedUrl ? `<podcast:newFeedUrl>${escapeXml(podcastConfig.podcast.newFeedUrl)}</podcast:newFeedUrl>` : ''}
    ${podcastConfig.podcast.funding && podcastConfig.podcast.funding.length > 0 ?
      podcastConfig.podcast.funding.map(funding => {
        // Convert relative URLs to absolute URLs for RSS feed
        const absoluteUrl = funding.startsWith('/') || funding.startsWith('./') || funding.startsWith('../') 
          ? `${baseUrl}${funding.startsWith('/') ? funding : '/' + funding.replace(/^\.\//, '')}`
          : funding;
        return `<podcast:funding url="${escapeXml(absoluteUrl)}">Support this podcast</podcast:funding>`;
      }).join('\n    ') :
      `<podcast:funding url="${escapeXml(podcastUrl)}">Support this podcast via Lightning</podcast:funding>`
    }
    ${podcastConfig.podcast.value && podcastConfig.podcast.value.amount > 0 ?
      `<podcast:value type="${podcastConfig.podcast.value.currency}" method="lightning">
        ${podcastConfig.podcast.value.recipients && podcastConfig.podcast.value.recipients.length > 0 ?
          podcastConfig.podcast.value.recipients.map(recipient =>
            `<podcast:valueRecipient name="${escapeXml(recipient.name)}" type="${escapeXml(recipient.type)}" address="${escapeXml(recipient.address)}" split="${recipient.split}"${recipient.customKey ? ` customKey="${escapeXml(recipient.customKey)}"` : ''}${recipient.customValue ? ` customValue="${escapeXml(recipient.customValue)}"` : ''}${recipient.fee ? ` fee="true"` : ''} />`
          ).join('\n        ') :
          `<podcast:valueRecipient name="${escapeXml(podcastConfig.podcast.author)}" type="node" address="${escapeXml(podcastConfig.podcast.funding?.[0] || '')}" split="100" />`
        }
      </podcast:value>` : ''
    }

    <!-- Generator -->
    <generator>PODSTR - Nostr Podcast Platform</generator>

    ${rssItems.map(item => `
    <item>
      <title>${escapeXml(item.title)}</title>
      <description>${escapeXml(item.description)}</description>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="false">${escapeXml(item.guid)}</guid>
      <pubDate>${item.pubDate}</pubDate>
      <author>${escapeXml(item.author || podcastConfig.podcast.email)}</author>
      ${item.category?.map(cat => `<category>${escapeXml(cat)}</category>`).join('\n      ') || ''}

      <!-- Enclosure (required for podcasts) -->
      <enclosure url="${escapeXml(item.enclosure.url)}"
                 length="${item.enclosure.length}"
                 type="${escapeXml(item.enclosure.type)}" />

      <!-- iTunes tags -->
      <itunes:title>${escapeXml(item.title)}</itunes:title>
      <itunes:summary>${escapeXml(item.description)}</itunes:summary>
      <itunes:author>${escapeXml(podcastConfig.podcast.author)}</itunes:author>
      ${item.duration ? `<itunes:duration>${item.duration}</itunes:duration>` : ''}
      ${item.episodeNumber ? `<itunes:episode>${item.episodeNumber}</itunes:episode>` : ''}
      ${item.seasonNumber ? `<itunes:season>${item.seasonNumber}</itunes:season>` : ''}
      <itunes:explicit>${item.explicit ? 'true' : 'false'}</itunes:explicit>
      ${item.image ? `<itunes:image href="${escapeXml(item.image)}" />` : ''}

      <!-- Podcasting 2.0 tags -->
      <podcast:guid>${escapeXml(item.guid)}</podcast:guid>
      ${item.transcriptUrl ? `<podcast:transcript url="${escapeXml(item.transcriptUrl)}" type="text/plain" />` : ''}
      ${item.chaptersUrl ? `<podcast:chapters url="${escapeXml(item.chaptersUrl)}" type="application/json+chapters" />` : ''}
      ${item.value && item.value.enabled && item.value.recipients && item.value.recipients.length > 0 ?
        `<podcast:value type="${item.value.currency || 'lightning'}" method="lightning">
        ${item.value.recipients.map(recipient =>
          `<podcast:valueRecipient name="${escapeXml(recipient.name)}" type="${escapeXml(recipient.type)}" address="${escapeXml(recipient.address)}" split="${recipient.split}"${recipient.customKey ? ` customKey="${escapeXml(recipient.customKey)}"` : ''}${recipient.customValue ? ` customValue="${escapeXml(recipient.customValue)}"` : ''}${recipient.fee ? ` fee="true"` : ''} />`
        ).join('\n        ')}
      </podcast:value>` : ''}
    </item>`).join('')}
  </channel>
</rss>`;

  return xml;
}

/**
 * Downloads RSS feed as a file
 */
export function downloadRSSFeed(episodes: PodcastEpisode[]): void {
  const xml = generateRSSFeed(episodes);
  const blob = new Blob([xml], { type: 'application/rss+xml' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'podcast-feed.xml';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Hook to generate RSS feed content
 */
export function useRSSFeed(episodes: PodcastEpisode[] | undefined): string | null {
  if (!episodes) return null;
  return generateRSSFeed(episodes);
}

/**
 * Generate RSS feed and make it available at /rss.xml
 * This function should be called when podcast metadata or episodes are updated
 */
export async function genRSSFeed(episodes?: PodcastEpisode[], config?: PodcastConfig): Promise<void> {
  try {
    // Fetch episodes if not provided
    if (!episodes) {
      // This is a placeholder - in a real implementation, you'd fetch episodes from your data source
      console.warn('genRSSFeed called without episodes - using placeholder data');
      episodes = [];
    }

    // Generate RSS XML with provided configuration or fallback to hardcoded config
    const rssContent = generateRSSFeed(episodes, config);

    // Create a blob and object URL
    const blob = new Blob([rssContent], { type: 'application/rss+xml' });
    const rssUrl = URL.createObjectURL(blob);

    // Store the RSS content in localStorage for the RSSFeed component to use
    localStorage.setItem('podcast-rss-content', rssContent);
    localStorage.setItem('podcast-rss-updated', Date.now().toString());

    // Log success
    console.log('RSS feed generated and updated');

    // Clean up the object URL
    setTimeout(() => URL.revokeObjectURL(rssUrl), 1000);

  } catch (error) {
    console.error('Failed to generate RSS feed:', error);
    throw new Error('Failed to generate RSS feed');
  }
}