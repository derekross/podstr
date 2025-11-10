import { useQuery } from '@tanstack/react-query';
import { usePodcastMetadata } from '@/hooks/usePodcastMetadata';

// OP3 API types
interface OP3Analytics {
  // Summary stats
  totalDownloads: number;
  uniqueAudience: number;
  downloads7Days: number;
  downloads30Days: number;

  // By episode
  episodeStats: Array<{
    episodeId: string;
    url: string;
    downloads: number;
    uniqueListeners: number;
  }>;

  // Geographic data
  topCountries: Array<{
    countryCode: string;
    count: number;
    percentage: number;
  }>;

  // Device/App data
  topApps: Array<{
    appName: string;
    count: number;
    percentage: number;
  }>;

  topDevices: Array<{
    deviceType: string;
    count: number;
    percentage: number;
  }>;

  // Time series data for charts - dynamic per-episode data
  downloadsOverTime: Array<Record<string, string | number>>;
}

/**
 * Hook to fetch and process OP3.dev analytics data
 * Only runs if OP3 is enabled in podcast settings and API credentials are configured
 */
export function useOP3Analytics(timeRange: '7d' | '30d' | '90d' | 'month' = '30d') {
  const { data: podcastMetadata } = usePodcastMetadata();

  const apiToken = import.meta.env.VITE_OP3_API_TOKEN;
  const rawGuid = import.meta.env.VITE_PODCAST_GUID;
  // OP3 API requires 32-char hex format (no dashes)
  const showUuid = rawGuid?.replace(/-/g, '');
  const useOP3 = podcastMetadata?.useOP3 || false;

  return useQuery<OP3Analytics>({
    queryKey: ['op3-analytics', showUuid, timeRange],
    queryFn: async ({ signal }) => {
      if (!apiToken || !rawGuid) {
        throw new Error('OP3 API credentials not configured');
      }

      // Use /shows/ endpoint with podcast:guid (dashed format)
      // The endpoint accepts: showUuid, podcastGuid, or feedUrlBase64
      const url = `https://op3.dev/api/1/shows/${rawGuid}?episodes=include&token=${apiToken}`;

      const response = await fetch(url, {
        signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OP3 API error:', response.status, errorText);
        throw new Error(`OP3 API error: ${response.status} - ${errorText}`);
      }

      interface Episode {
        id: string;
        title?: string;
        pubdate?: string;
      }

      interface ShowResponse {
        showUuid: string;
        title?: string;
        podcastGuid?: string;
        statsPageUrl: string;
        episodes?: Episode[];
      }

      const data: ShowResponse = await response.json();

      // Create a map of episode IDs to titles for later lookup
      const episodeTitleMap = new Map<string, string>();
      (data.episodes || []).forEach(ep => {
        if (ep.title) {
          episodeTitleMap.set(ep.id, ep.title);
        }
      });

      // Now use the OP3 show UUID to fetch download data
      let startDate: string;
      let endDate: string;
      let days: number;

      if (timeRange === 'month') {
        // Current calendar month (e.g., Nov 1 - today)
        const now = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        endDate = now.toISOString().split('T')[0];
        days = now.getDate(); // Days elapsed in current month
      } else {
        // Rolling time periods
        const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
        days = daysMap[timeRange];
        startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        endDate = new Date().toISOString().split('T')[0];
      }

      const downloadsUrl = `https://op3.dev/api/1/downloads/show/${data.showUuid}?start=${startDate}&end=${endDate}&limit=20000&format=json&token=${apiToken}`;

      const downloadsResponse = await fetch(downloadsUrl, { signal });

      if (!downloadsResponse.ok) {
        console.error('Downloads API error:', downloadsResponse.status);
        // Return basic show data without downloads if this fails
        return {
          totalDownloads: 0,
          uniqueAudience: 0,
          downloads7Days: 0,
          downloads30Days: 0,
          episodeStats: [],
          topCountries: [],
          topApps: [],
          topDevices: [],
          downloadsOverTime: [],
        };
      }

      interface DownloadRow {
        time: string;
        url: string;
        agentName?: string;
        deviceType?: string;
        deviceName?: string;
        countryCode?: string;
        episodeId?: string;
        hashedIpAddress?: string;
      }

      const downloadsData = await downloadsResponse.json();
      const allRows: DownloadRow[] = downloadsData.rows || [];

      // Calculate totals
      const totalDownloads = allRows.length;
      const now7d = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const now30d = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const rows7Days = allRows.filter(r => new Date(r.time).getTime() >= now7d);
      const rows30Days = allRows.filter(r => new Date(r.time).getTime() >= now30d);
      const downloads7Days = rows7Days.length;
      const downloads30Days = rows30Days.length;

      // Calculate unique audience (unique IP hashes for the selected time range)
      const uniqueIpHashes = new Set(allRows.map(r => r.hashedIpAddress).filter(Boolean));
      const uniqueAudience = uniqueIpHashes.size;

      // Episode stats with unique listeners per episode
      const episodeMap = new Map<string, { downloads: number; uniqueIps: Set<string> }>();
      allRows.forEach(row => {
        const id = row.episodeId || row.url;
        if (!episodeMap.has(id)) {
          episodeMap.set(id, { downloads: 0, uniqueIps: new Set() });
        }
        const stats = episodeMap.get(id)!;
        stats.downloads += 1;
        if (row.hashedIpAddress) {
          stats.uniqueIps.add(row.hashedIpAddress);
        }
      });

      const episodeStats = Array.from(episodeMap.entries())
        .map(([id, stats]) => ({
          episodeId: id,
          url: episodeTitleMap.get(id) || id, // Use episode title if available, otherwise use ID
          downloads: stats.downloads,
          uniqueListeners: stats.uniqueIps.size,
        }))
        .sort((a, b) => b.downloads - a.downloads);

      // App stats
      const appMap = new Map<string, number>();
      allRows.forEach(row => {
        if (row.agentName) {
          appMap.set(row.agentName, (appMap.get(row.agentName) || 0) + 1);
        }
      });

      const topApps = Array.from(appMap.entries())
        .map(([appName, count]) => ({
          appName,
          count,
          percentage: (count / totalDownloads) * 100,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Country stats
      const countryMap = new Map<string, number>();
      allRows.forEach(row => {
        if (row.countryCode) {
          countryMap.set(row.countryCode, (countryMap.get(row.countryCode) || 0) + 1);
        }
      });

      const topCountries = Array.from(countryMap.entries())
        .map(([countryCode, count]) => ({
          countryCode,
          count,
          percentage: (count / totalDownloads) * 100,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Device stats
      const deviceMap = new Map<string, number>();
      allRows.forEach(row => {
        if (row.deviceType) {
          deviceMap.set(row.deviceType, (deviceMap.get(row.deviceType) || 0) + 1);
        }
      });

      const topDevices = Array.from(deviceMap.entries())
        .map(([deviceType, count]) => ({
          deviceType,
          count,
          percentage: (count / totalDownloads) * 100,
        }))
        .sort((a, b) => b.count - a.count);

      // Time series (daily per episode)
      // Create a map of date -> episode -> downloads
      const episodeDailyMap = new Map<string, Map<string, number>>();
      allRows.forEach(row => {
        const date = row.time.split('T')[0];
        const episodeId = row.episodeId || row.url;

        if (!episodeDailyMap.has(date)) {
          episodeDailyMap.set(date, new Map());
        }
        const dayMap = episodeDailyMap.get(date)!;
        dayMap.set(episodeId, (dayMap.get(episodeId) || 0) + 1);
      });

      // Get all unique dates and sort them
      const allDates = Array.from(episodeDailyMap.keys()).sort();

      // Get all unique episode IDs first
      const allEpisodeIds = new Set<string>();
      episodeDailyMap.forEach(dayMap => {
        dayMap.forEach((_, episodeId) => {
          allEpisodeIds.add(episodeId);
        });
      });

      // Build cumulative data per episode
      const episodeCumulativeMap = new Map<string, number>();

      // Initialize all episodes to 0
      allEpisodeIds.forEach(episodeId => {
        episodeCumulativeMap.set(episodeId, 0);
      });

      const downloadsOverTime = allDates.map(date => {
        const dayData = episodeDailyMap.get(date)!;
        const dataPoint: Record<string, string | number> = { date };

        // Update cumulative for each episode that had downloads this day
        dayData.forEach((count, episodeId) => {
          episodeCumulativeMap.set(episodeId, (episodeCumulativeMap.get(episodeId) || 0) + count);
        });

        // Add ALL episode cumulative values to this data point using episodeId as key
        episodeCumulativeMap.forEach((cumulative, episodeId) => {
          dataPoint[episodeId] = cumulative;
        });

        return dataPoint;
      });

      return {
        totalDownloads,
        uniqueAudience,
        downloads7Days,
        downloads30Days,
        episodeStats,
        topCountries,
        topApps,
        topDevices,
        downloadsOverTime,
      };
    },
    enabled: useOP3 && !!apiToken && !!showUuid,
    staleTime: 1000 * 60 * 15, // 15 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
    retry: 1,
  });
}

/**
 * Hook to check if OP3 analytics are available
 */
export function useOP3Available() {
  const { data: podcastMetadata } = usePodcastMetadata();
  const apiToken = import.meta.env.VITE_OP3_API_TOKEN;
  const rawGuid = import.meta.env.VITE_PODCAST_GUID;
  const showUuid = rawGuid?.replace(/-/g, '');
  const useOP3 = podcastMetadata?.useOP3 || false;

  return {
    isAvailable: useOP3 && !!apiToken && !!showUuid,
    isEnabled: useOP3,
    hasCredentials: !!apiToken && !!showUuid,
  };
}
