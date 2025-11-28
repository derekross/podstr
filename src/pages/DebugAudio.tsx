import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AudioPlayer } from '@/components/podcast/AudioPlayer';
import type { PodcastEpisode } from '@/types/podcast';

export default function DebugAudio() {
  const [testUrl, setTestUrl] = useState('https://www.soundjay.com/misc/sounds/fail-buzzer-02.wav');

  // Create a mock episode for testing
  const createTestEpisode = (audioUrl: string): PodcastEpisode => ({
    id: 'test-episode',
    title: 'Test Audio Episode',
    description: 'Testing audio playback functionality',
    audioUrl,
    audioType: 'audio/wav',
    publishDate: new Date(),
    tags: ['test'],
    eventId: 'test-event',
    authorPubkey: 'test-pubkey',
    identifier: 'test-episode-identifier',
    createdAt: new Date(),
    episodeNumber: 1,
    seasonNumber: undefined
  });

  const [currentEpisode, setCurrentEpisode] = useState<PodcastEpisode | null>(null);

  const handleTestAudio = () => {
    if (testUrl.trim()) {
      setCurrentEpisode(createTestEpisode(testUrl.trim()));
    }
  };

  const testUrls = [
    {
      name: 'SoundJay Test Audio (WAV)',
      url: 'https://www.soundjay.com/misc/sounds/fail-buzzer-02.wav'
    },
    {
      name: 'File Sample MP3',
      url: 'https://file-examples.com/storage/fe68c7beb669e21964c1e8a/2017/11/file_example_MP3_700KB.mp3'
    },
    {
      name: 'Sample Videos MP3',
      url: 'https://sample-videos.com/zip/10/mp3/SampleAudio_0.4mb_mp3.mp3'
    }
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Audio Player Debug</CardTitle>
          <p className="text-sm text-muted-foreground">
            Test audio playback with different URLs to debug issues
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Custom URL Test */}
          <div className="space-y-3">
            <h3 className="text-lg font-medium">Test Custom URL</h3>
            <div className="flex space-x-2">
              <Input
                placeholder="Enter audio URL to test..."
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleTestAudio} disabled={!testUrl.trim()}>
                Test Audio
              </Button>
            </div>
          </div>

          {/* Preset URLs */}
          <div className="space-y-3">
            <h3 className="text-lg font-medium">Test Known URLs</h3>
            <div className="grid gap-2">
              {testUrls.map((preset) => (
                <div key={preset.name} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{preset.name}</p>
                    <p className="text-xs text-muted-foreground font-mono break-all">
                      {preset.url}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setTestUrl(preset.url);
                      setCurrentEpisode(createTestEpisode(preset.url));
                    }}
                  >
                    Test
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Audio Player */}
          {currentEpisode && (
            <div className="space-y-3">
              <h3 className="text-lg font-medium">Audio Player</h3>
              <AudioPlayer episode={currentEpisode} />
            </div>
          )}

          {/* Browser Audio Support Info */}
          <div className="space-y-3">
            <h3 className="text-lg font-medium">Browser Support Info</h3>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="text-sm">
                <strong>User Agent:</strong> {navigator.userAgent}
              </p>
              <p className="text-sm">
                <strong>Audio Support:</strong>
              </p>
              <ul className="text-sm space-y-1 ml-4">
                <li>MP3: {document.createElement('audio').canPlayType('audio/mpeg') || 'No'}</li>
                <li>WAV: {document.createElement('audio').canPlayType('audio/wav') || 'No'}</li>
                <li>OGG: {document.createElement('audio').canPlayType('audio/ogg') || 'No'}</li>
                <li>AAC: {document.createElement('audio').canPlayType('audio/aac') || 'No'}</li>
              </ul>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Debug Steps:</h4>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Test with the preset URLs to verify basic audio playback works</li>
              <li>Check the browser console for detailed error messages</li>
              <li>Verify your uploaded audio files are accessible</li>
              <li>Check if CORS headers are properly set on your Blossom servers</li>
              <li>Try different audio formats (MP3, WAV, etc.)</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}