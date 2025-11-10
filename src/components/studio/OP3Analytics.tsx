import { useState } from 'react';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  TrendingUp,
  Globe,
  Smartphone,
  Download,
  Calendar,
  Info,
  AlertCircle,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useOP3Analytics, useOP3Available } from '@/hooks/useOP3Analytics';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const CHART_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#a855f7', // Purple
  '#f59e0b', // Orange
  '#ec4899', // Pink
];

export function OP3Analytics() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'month'>('month');
  const { data: analytics, isLoading, error } = useOP3Analytics(timeRange);
  const { isAvailable, isEnabled, hasCredentials } = useOP3Available();

  // If OP3 is not enabled or credentials are missing
  if (!isAvailable) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5" />
            <span>OP3.dev Analytics</span>
          </CardTitle>
          <CardDescription>
            Advanced podcast download analytics powered by OP3.dev
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isEnabled ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>OP3 Analytics Not Enabled</AlertTitle>
              <AlertDescription>
                Enable OP3 analytics in your podcast settings to track downloads, audience demographics, and more.
                <br />
                <a
                  href="https://op3.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline mt-2 inline-block"
                >
                  Learn more about OP3.dev →
                </a>
              </AlertDescription>
            </Alert>
          ) : !hasCredentials ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>OP3 API Token Missing</AlertTitle>
              <AlertDescription>
                Add your OP3 API token to your environment variables:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">VITE_OP3_API_TOKEN</code> - Your OP3 API token
                  </li>
                </ul>
                <p className="mt-2 text-sm">
                  OP3.dev uses your existing <code className="text-xs bg-muted px-1 py-0.5 rounded">VITE_PODCAST_GUID</code> as the show UUID.
                </p>
                <a
                  href="https://op3.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline mt-2 inline-block"
                >
                  Get your API token at OP3.dev →
                </a>
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5" />
            <span>OP3.dev Analytics</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Loading Analytics</AlertTitle>
            <AlertDescription>
              Failed to load OP3 analytics data. Please check your API credentials and try again.
              <br />
              <span className="text-xs mt-1 block">Error: {error instanceof Error ? error.message : 'Unknown error'}</span>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Time Range Selector */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5" />
                <span>OP3.dev Analytics</span>
                <Badge variant="secondary" className="ml-2">
                  Live Data
                </Badge>
              </CardTitle>
              <CardDescription>
                Comprehensive download analytics powered by OP3.dev
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant={timeRange === 'month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRange('month')}
              >
                This Month
              </Button>
              <Button
                variant={timeRange === '7d' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRange('7d')}
              >
                7 Days
              </Button>
              <Button
                variant={timeRange === '30d' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRange('30d')}
              >
                30 Days
              </Button>
              <Button
                variant={timeRange === '90d' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRange('90d')}
              >
                90 Days
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {isLoading ? (
        <AnalyticsLoading />
      ) : analytics ? (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Downloads</p>
                    <p className="text-3xl font-bold">{analytics.totalDownloads.toLocaleString()}</p>
                  </div>
                  <Download className="w-8 h-8 text-primary opacity-80" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Unique Listeners</p>
                    <p className="text-3xl font-bold">{analytics.uniqueAudience.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-1">in selected period</p>
                  </div>
                  <Users className="w-8 h-8 text-blue-500 opacity-80" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Last 7 Days</p>
                    <p className="text-3xl font-bold">{analytics.downloads7Days.toLocaleString()}</p>
                  </div>
                  <Calendar className="w-8 h-8 text-green-500 opacity-80" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Last 30 Days</p>
                    <p className="text-3xl font-bold">{analytics.downloads30Days.toLocaleString()}</p>
                  </div>
                  <Calendar className="w-8 h-8 text-purple-500 opacity-80" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Downloads Over Time Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Episode Downloads</CardTitle>
              <CardDescription>Cumulative downloads over time by episode</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.downloadsOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                    labelFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    formatter={(value: number, name: string) => {
                      // Find the episode title for this episodeId
                      const episode = analytics.episodeStats.find(ep => ep.episodeId === name);
                      return [value, episode?.url || name];
                    }}
                  />
                  {analytics.episodeStats.slice(0, 6).map((episode, index) => (
                    <Line
                      key={episode.episodeId}
                      type="stepAfter"
                      dataKey={episode.episodeId}
                      stroke={CHART_COLORS[index % CHART_COLORS.length]}
                      strokeWidth={2.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>

              {/* Episode Legend */}
              <div className="flex flex-wrap gap-3 text-sm">
                {analytics.episodeStats.slice(0, 6).map((episode, index) => (
                  <div key={episode.episodeId} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                    <span className="text-muted-foreground truncate max-w-[200px]">
                      {episode.url}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Episodes */}
            <Card>
              <CardHeader>
                <CardTitle>Top Episodes</CardTitle>
                <CardDescription>Most downloaded episodes in this period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.episodeStats.slice(0, 10).map((episode, index) => (
                    <div key={episode.episodeId} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{episode.url.split('/').pop()}</p>
                          <p className="text-xs text-muted-foreground">
                            {episode.uniqueListeners} unique listeners
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">{episode.downloads}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Countries */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Globe className="w-5 h-5" />
                  <span>Top Countries</span>
                </CardTitle>
                <CardDescription>Geographic distribution of listeners</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.topCountries.map((country, index) => (
                    <div key={country.countryCode} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{country.countryCode}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-muted-foreground">{country.percentage.toFixed(1)}%</span>
                          <Badge variant="outline">{country.count}</Badge>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: `${country.percentage}%`,
                            backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Apps */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Smartphone className="w-5 h-5" />
                  <span>Top Podcast Apps</span>
                </CardTitle>
                <CardDescription>Most popular podcast players</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.topApps.map((app, index) => (
                    <div key={app.appName} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate flex-1">{app.appName}</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-muted-foreground">{app.percentage.toFixed(1)}%</span>
                          <Badge variant="outline">{app.count}</Badge>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: `${app.percentage}%`,
                            backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Device Types */}
            <Card>
              <CardHeader>
                <CardTitle>Device Types</CardTitle>
                <CardDescription>Listener device breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.topDevices}
                      dataKey="count"
                      nameKey="deviceType"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry) => `${entry.deviceType} (${entry.percentage.toFixed(1)}%)`}
                      labelLine={{ stroke: 'hsl(var(--foreground))', strokeWidth: 1 }}
                      style={{ fill: 'hsl(var(--foreground))' }}
                    >
                      {analytics.topDevices.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}

function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      {/* Summary Stats Loading */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart Loading */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>

      {/* Two Column Loading */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[...Array(5)].map((_, j) => (
                  <div key={j} className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
