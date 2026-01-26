import { useSeoMeta } from '@unhead/react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Headphones, Rss, Zap, Users, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layout } from '@/components/Layout';
import { EpisodeList } from '@/components/podcast/EpisodeList';
import { ZapLeaderboard } from '@/components/podcast/ZapLeaderboard';
import { RecentActivity } from '@/components/podcast/RecentActivity';
import { ZapDialog } from '@/components/ZapDialog';
import type { PodcastEpisode } from '@/types/podcast';
import { useLatestEpisode } from '@/hooks/usePodcastEpisodes';
import { usePodcastConfig } from '@/hooks/usePodcastConfig';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { getCreatorPubkeyHex } from '@/lib/podcastConfig';

const Index = () => {
  const { data: latestEpisode } = useLatestEpisode();
  const podcastConfig = usePodcastConfig();
  const { data: creator } = useAuthor(getCreatorPubkeyHex());
  const { user } = useCurrentUser();
  const { playEpisode } = useAudioPlayer();
  const _currentEpisode = useState<PodcastEpisode | null>(null);

  const handlePlayLatestEpisode = () => {
    if (latestEpisode) {
      playEpisode(latestEpisode);
    }
  };

  useSeoMeta({
    title: podcastConfig.podcast.title,
    description: podcastConfig.podcast.description,
  });

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-8">
            {/* Latest Episode Highlight */}
            {latestEpisode && (
              <section className="animate-fade-in">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-3xl font-bold gradient-text">Latest Episode</h2>
                  <Badge variant="secondary" className="animate-pulse-slow">New</Badge>
                </div>

                <Card className="card-hover bg-gradient-to-br from-primary/5 via-secondary/5 to-primary/5 border-primary/20 overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row items-start space-y-6 lg:space-y-0 lg:space-x-6">
                      {latestEpisode.imageUrl && (
                        <div className="relative group">
                          <img
                            src={latestEpisode.imageUrl}
                            alt={latestEpisode.title}
                            className="w-32 h-32 lg:w-40 lg:h-40 rounded-xl object-cover flex-shrink-0 shadow-lg group-hover:shadow-xl transition-shadow duration-300"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        </div>
                      )}

                      <div className="flex-1 min-w-0 space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {latestEpisode.episodeNumber && (
                            <Badge variant="outline" className="border-primary/30 text-primary">
                              Episode {latestEpisode.episodeNumber}
                            </Badge>
                          )}
                          {latestEpisode.explicit && (
                            <Badge variant="destructive" className="animate-pulse">Explicit</Badge>
                          )}
                        </div>

                        <h3 className="text-2xl lg:text-3xl font-bold line-clamp-2 leading-tight">
                          {latestEpisode.title}
                        </h3>

                        {latestEpisode.description && (
                          <p className="text-muted-foreground mb-4 line-clamp-3 leading-relaxed">
                            {latestEpisode.description}
                          </p>
                        )}

                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                          <Button onClick={handlePlayLatestEpisode} className="btn-primary focus-ring">
                            <Headphones className="w-4 h-4 mr-2" />
                            Listen Now
                          </Button>

                          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                            {user && latestEpisode.totalSats && latestEpisode.totalSats > 0 && (
                              <div className="flex items-center space-x-1 bg-primary/10 px-2 py-1 rounded-full">
                                <Zap className="w-3 h-3 text-primary" />
                                <span className="font-medium">
                                  {latestEpisode.totalSats.toLocaleString()} sats
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>
            )}

            {/* Quick Navigation */}
            <section className="animate-fade-in-up">
              <h2 className="text-3xl font-bold mb-6 gradient-text">Explore</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Link to="/episodes" className="group">
                  <Card className="card-hover border-primary/20 hover:border-primary/40 bg-gradient-to-br from-primary/5 to-transparent h-full">
                    <CardContent className="p-6 text-center space-y-4">
                      <div className="relative">
                        <Headphones className="w-12 h-12 mx-auto text-primary group-hover:scale-110 transition-transform duration-300" />
                        <div className="absolute inset-0 bg-primary/20 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      </div>
                      <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">All Episodes</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Browse and listen to all podcast episodes
                      </p>
                    </CardContent>
                  </Card>
                </Link>

                <Link to="/community" className="group">
                  <Card className="card-hover border-secondary/20 hover:border-secondary/40 bg-gradient-to-br from-secondary/5 to-transparent h-full">
                    <CardContent className="p-6 text-center space-y-4">
                      <div className="relative">
                        <Users className="w-12 h-12 mx-auto text-secondary group-hover:scale-110 transition-transform duration-300" />
                        <div className="absolute inset-0 bg-secondary/20 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      </div>
                      <h3 className="text-lg font-semibold mb-2 group-hover:text-secondary transition-colors">Community</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Engage with listeners and top supporters
                      </p>
                    </CardContent>
                  </Card>
                </Link>

                <Link to="/social" className="group">
                  <Card className="card-hover border-primary/20 hover:border-primary/40 bg-gradient-to-br from-primary/5 to-transparent h-full">
                    <CardContent className="p-6 text-center space-y-4">
                      <div className="relative">
                        <MessageSquare className="w-12 h-12 mx-auto text-primary group-hover:scale-110 transition-transform duration-300" />
                        <div className="absolute inset-0 bg-primary/20 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      </div>
                      <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">Social Feed</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Follow the creator's latest updates
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            </section>


            {/* Recent Episodes Preview */}
            <section className="animate-fade-in-up">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold gradient-text">Recent Episodes</h2>
                <Button variant="outline" asChild className="focus-ring">
                  <Link to="/episodes" className="group">
                    View All Episodes
                    <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </Button>
              </div>

              <EpisodeList
                showSearch={false}
                _showPlayer={false}
                limit={3}
                infiniteScroll={false}
                onPlayEpisode={(episode) => {
                  playEpisode(episode);
                }}
              />
            </section>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Podcast Info */}
            <Card className="card-hover border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader>
                <CardTitle className="gradient-text">About This Podcast</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {podcastConfig.podcast.image && (
                  <div className="relative group">
                    <img
                      src={podcastConfig.podcast.image}
                      alt={podcastConfig.podcast.title}
                      className="w-full rounded-xl object-cover shadow-lg group-hover:shadow-xl transition-shadow duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </div>
                )}

                <p className="text-sm text-muted-foreground leading-relaxed">
                  {podcastConfig.podcast.description}
                </p>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-muted-foreground">Host:</span>
                    <span className="font-medium">{podcastConfig.podcast.author}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-muted-foreground">Language:</span>
                    <span className="font-medium">{podcastConfig.podcast.language.toUpperCase()}</span>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground block mb-2">Categories:</span>
                    <div className="flex flex-wrap gap-1">
                      {podcastConfig.podcast.categories.map((category) => (
                        <Badge key={category} variant="outline" className="text-xs border-primary/30 text-primary">
                          {category}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <Button variant="outline" className="w-full focus-ring" asChild>
                  <Link to="/about" className="group">
                    Learn More
                    <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Subscribe Links */}
            <Card className="card-hover border-secondary/20 bg-gradient-to-br from-secondary/5 to-transparent">
              <CardHeader>
                <CardTitle className="gradient-text">Subscribe</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start focus-ring" asChild>
                  <a href="/rss.xml" target="_blank" rel="noopener noreferrer" className="group">
                    <Rss className="w-4 h-4 mr-2 group-hover:animate-pulse" />
                    RSS Feed
                    <svg className="w-4 h-4 ml-auto group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </Button>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  Copy the RSS feed URL to subscribe in your favorite podcast app.
                </p>
              </CardContent>
            </Card>

            {/* Zap Leaderboard */}
            <ZapLeaderboard limit={5} />

            {/* Recent Activity */}
            <RecentActivity limit={10} />

            {/* Support */}
            <Card className="card-hover border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader>
                <CardTitle className="gradient-text">Support the Show</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Support this podcast by zapping episodes, sharing with friends, and engaging with the community.
                </p>

                {creator?.event && user && (creator.metadata?.lud16 || creator.metadata?.lud06) ? (
                  <ZapDialog target={creator.event}>
                    <Button variant="outline" className="w-full btn-primary focus-ring">
                      <Zap className="w-4 h-4 mr-2 animate-pulse" />
                      Zap the Show
                    </Button>
                  </ZapDialog>
                ) : (
                  <Button variant="outline" className="w-full" disabled>
                    <Zap className="w-4 h-4 mr-2" />
                    {!user ? "Login to Zap" : "Creator has no Lightning address"}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Vibed with MKStack */}
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-xs text-muted-foreground">
                  Vibed with{' '}
                  <a
                    href="https://soapbox.pub/mkstack"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    MKStack
                  </a>
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Index;