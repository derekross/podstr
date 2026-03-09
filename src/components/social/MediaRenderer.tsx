import { useState } from 'react';
import { Play, Pause, Volume2, Download, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type MediaItem } from '@/lib/mediaUtils';
import { isSafeUrl } from '@/lib/utils';

interface MediaRendererProps {
  media: MediaItem[];
  className?: string;
}

export function MediaRenderer({ media, className }: MediaRendererProps) {
  if (media.length === 0) return null;

  return (
    <div className={cn('space-y-3', className)}>
      {media.map((item, index) => (
        <MediaItem key={`${item.url}-${index}`} media={item} />
      ))}
    </div>
  );
}

interface MediaItemProps {
  media: MediaItem;
}

function MediaItem({ media }: MediaItemProps) {
  // Validate URL protocol before rendering any user-controlled media
  if (!isSafeUrl(media.url)) return null;

  switch (media.type) {
    case 'image':
      return <ImageRenderer media={media} />;
    case 'video':
      return <VideoRenderer media={media} />;
    case 'audio':
      return <AudioRenderer media={media} />;
    default:
      return null;
  }
}

function ImageRenderer({ media }: MediaItemProps) {
  const [imageError, setImageError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (imageError) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-4 text-center">
          <p className="text-sm text-muted-foreground mb-2">Unable to load image</p>
          <Button variant="outline" size="sm" asChild>
            <a href={media.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" />
              View Original
            </a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="relative">
        {!loaded && (
          <div className="absolute inset-0 bg-muted animate-pulse rounded-lg" style={{ aspectRatio: '16/9' }} />
        )}
        <img
          src={media.url}
          alt="Attached image"
          className={cn(
            'w-full h-auto max-h-96 object-contain rounded-lg transition-opacity',
            loaded ? 'opacity-100' : 'opacity-0'
          )}
          onLoad={() => setLoaded(true)}
          onError={() => setImageError(true)}
          loading="lazy"
        />

      </div>
    </Card>
  );
}

function VideoRenderer({ media }: MediaItemProps) {
  return (
    <Card className="overflow-hidden">
      <div className="relative">
        <video
          src={media.url}
          controls
          className="w-full h-auto max-h-96 rounded-lg"
          preload="metadata"
        >
          Your browser does not support the video element.
        </video>

      </div>
    </Card>
  );
}

function AudioRenderer({ media }: MediaItemProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState(false);

  // Extract filename from URL for display
  const getFilename = (url: string) => {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      return pathname.split('/').pop() || 'Audio file';
    } catch {
      return 'Audio file';
    }
  };

  const handlePlayPause = (audio: HTMLAudioElement) => {
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => setAudioError(true));
    }
    setIsPlaying(!isPlaying);
  };

  if (audioError) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Volume2 className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">{getFilename(media.url)}</p>
                <p className="text-xs text-muted-foreground">Unable to load audio</p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href={media.url} target="_blank" rel="noopener noreferrer">
                <Download className="w-4 h-4" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                const audio = e.currentTarget.parentElement?.parentElement?.querySelector('audio') as HTMLAudioElement;
                if (audio) handlePlayPause(audio);
              }}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>

            <div className="flex-1">
              <p className="font-medium text-sm">{getFilename(media.url)}</p>
            </div>
          </div>

          <Button variant="ghost" size="sm" asChild>
            <a href={media.url} target="_blank" rel="noopener noreferrer">
              <Download className="w-4 h-4" />
            </a>
          </Button>
        </div>

        <audio
          src={media.url}
          className="w-full mt-3"
          controls
          preload="metadata"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onError={() => setAudioError(true)}
        >
          Your browser does not support the audio element.
        </audio>
      </CardContent>
    </Card>
  );
}