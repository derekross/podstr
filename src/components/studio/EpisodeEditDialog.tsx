import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Upload, Save, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useUpdateEpisode } from '@/hooks/usePublishEpisode';
import { useToast } from '@/hooks/useToast';
import { getAudioDuration, formatDurationHuman } from '@/lib/audioDuration';
import type { PodcastEpisode, EpisodeFormData } from '@/types/podcast';

// Schema for episode editing (similar to publish but allows empty audio URLs for existing episodes)
const episodeEditSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  content: z.string().optional(),
  audioUrl: z.string().url().optional().or(z.literal('')),
  videoUrl: z.string().url().optional().or(z.literal('')),
  imageUrl: z.string().url().optional().or(z.literal('')),
  transcriptUrl: z.string().url().optional().or(z.literal('')),
  transcriptType: z.string().optional().or(z.literal('')),
  chaptersUrl: z.string().url().optional().or(z.literal('')),
  duration: z.number().positive().optional(),
  episodeNumber: z.number().positive().optional(),
  seasonNumber: z.number().positive().optional(),
  explicit: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
});

type EpisodeEditFormValues = z.infer<typeof episodeEditSchema>;

interface EpisodeEditDialogProps {
  episode: PodcastEpisode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EpisodeEditDialog({
  episode,
  open,
  onOpenChange,
  onSuccess
}: EpisodeEditDialogProps) {
  const { toast } = useToast();
  const { mutateAsync: updateEpisode, isPending } = useUpdateEpisode();

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [chaptersFile, setChaptersFile] = useState<File | null>(null);
  const [currentTag, setCurrentTag] = useState('');
  const [isDetectingDuration, setIsDetectingDuration] = useState(false);

  const form = useForm<EpisodeEditFormValues>({
    resolver: zodResolver(episodeEditSchema),
    defaultValues: {
      title: episode.title,
      description: episode.description || '',
      content: episode.content || '',
      audioUrl: episode.audioUrl || '',
      videoUrl: episode.videoUrl || '',
      imageUrl: episode.imageUrl || '',
      transcriptUrl: episode.transcriptUrl || '',
      transcriptType: episode.transcriptType || 'text/plain',
      chaptersUrl: episode.chaptersUrl || '',
      duration: episode.duration,
      episodeNumber: episode.episodeNumber,
      seasonNumber: episode.seasonNumber,
      explicit: episode.explicit || false,
      tags: episode.tags || [],
    },
  });

  const { watch, setValue, reset } = form;
  const tags = watch('tags');

  // Reset form when episode changes
  useEffect(() => {
    reset({
      title: episode.title,
      description: episode.description || '',
      content: episode.content || '',
      audioUrl: episode.audioUrl || '',
      videoUrl: episode.videoUrl || '',
      imageUrl: episode.imageUrl || '',
      transcriptUrl: episode.transcriptUrl || '',
      transcriptType: episode.transcriptType || 'text/plain',
      chaptersUrl: episode.chaptersUrl || '',
      duration: episode.duration,
      episodeNumber: episode.episodeNumber,
      seasonNumber: episode.seasonNumber,
      explicit: episode.explicit || false,
      tags: episode.tags || [],
    });
    setAudioFile(null);
    setVideoFile(null);
    setImageFile(null);
    setTranscriptFile(null);
    setChaptersFile(null);
    setCurrentTag('');
    setIsDetectingDuration(false);
  }, [episode, reset]);

  const handleAudioFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('audio/')) {
        toast({
          title: 'Invalid file type',
          description: 'Please select an audio file.',
          variant: 'destructive',
        });
        return;
      }

      // Validate file size (100MB limit)
      if (file.size > 100 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Audio file must be less than 100MB.',
          variant: 'destructive',
        });
        return;
      }

      setAudioFile(file);
      setValue('audioUrl', '');

      // Detect audio duration
      setIsDetectingDuration(true);
      try {
        const duration = await getAudioDuration(file);
        setValue('duration', duration);

        toast({
          title: 'Audio file selected',
          description: `${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB, ${formatDurationHuman(duration)})`,
        });
      } catch {
        toast({
          title: 'Audio file selected',
          description: `${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB) - Could not detect duration. You can enter it manually.`,
          variant: 'default',
        });
      } finally {
        setIsDetectingDuration(false);
      }
    }
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('video/')) {
        toast({
          title: 'Invalid file type',
          description: 'Please select a video file.',
          variant: 'destructive',
        });
        return;
      }

      // Validate file size (500MB limit)
      if (file.size > 500 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Video file must be less than 500MB.',
          variant: 'destructive',
        });
        return;
      }

      setVideoFile(file);
      setValue('videoUrl', '');

      toast({
        title: 'Video file selected',
        description: `${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`,
      });
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Invalid file type',
          description: 'Please select an image file.',
          variant: 'destructive',
        });
        return;
      }

      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Image file must be less than 10MB.',
          variant: 'destructive',
        });
        return;
      }

      setImageFile(file);
      setValue('imageUrl', '');

      toast({
        title: 'Image file selected',
        description: `${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`,
      });
    }
  };

  const handleTranscriptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Transcript file must be less than 5MB.',
          variant: 'destructive',
        });
        return;
      }

      setTranscriptFile(file);
      setValue('transcriptUrl', '');

      // Auto-detect transcript type
      const extension = file.name.split('.').pop()?.toLowerCase();
      let transcriptType = 'text/plain';
      if (extension === 'html') transcriptType = 'text/html';
      else if (extension === 'vtt') transcriptType = 'text/vtt';
      else if (extension === 'json') transcriptType = 'application/json';
      else if (extension === 'srt') transcriptType = 'application/x-subrip';

      setValue('transcriptType', transcriptType);

      toast({
        title: 'Transcript file selected',
        description: `${file.name} (${transcriptType})`,
      });
    }
  };

  const handleChaptersFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.includes('json') && !file.name.endsWith('.json')) {
        toast({
          title: 'Invalid file type',
          description: 'Please select a JSON file for chapters.',
          variant: 'destructive',
        });
        return;
      }

      // Validate file size (1MB limit)
      if (file.size > 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Chapters file must be less than 1MB.',
          variant: 'destructive',
        });
        return;
      }

      setChaptersFile(file);
      setValue('chaptersUrl', '');

      toast({
        title: 'Chapters file selected',
        description: `${file.name}`,
      });
    }
  };

  const addTag = () => {
    if (currentTag.trim() && !tags.includes(currentTag.trim())) {
      setValue('tags', [...tags, currentTag.trim()]);
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setValue('tags', tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const onSubmit = async (data: EpisodeEditFormValues) => {
    try {
      console.log('Starting episode update...');

      const episodeData: EpisodeFormData = {
        ...data,
        description: data.description || '',
        audioFile: audioFile || undefined,
        videoFile: videoFile || undefined,
        imageFile: imageFile || undefined,
        transcriptFile: transcriptFile || undefined,
        chaptersFile: chaptersFile || undefined,
        // Clean up empty URL strings
        audioUrl: data.audioUrl || undefined,
        videoUrl: data.videoUrl || undefined,
        imageUrl: data.imageUrl || undefined,
        transcriptUrl: data.transcriptUrl || undefined,
        transcriptType: data.transcriptType || undefined,
        chaptersUrl: data.chaptersUrl || undefined,
        // Keep existing external references
        externalRefs: episode.externalRefs,
      };

      console.log('Calling updateEpisode with:', { episodeId: episode.eventId, episodeIdentifier: episode.identifier, episodeData });

      const result = await updateEpisode({
        episodeId: episode.eventId,
        episodeIdentifier: episode.identifier,
        episodeData
      });

      console.log('UpdateEpisode completed with result:', result);

      toast({
        title: 'Episode updated!',
        description: 'Your episode has been updated successfully.',
      });

      onSuccess();
      onOpenChange(false);

    } catch (error) {
      console.error('Error in onSubmit:', error);
      toast({
        title: 'Failed to update episode',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] w-[95vw] sm:w-full sm:max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Edit Episode</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(95vh-8rem)] sm:max-h-[calc(90vh-8rem)] pr-2 sm:pr-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
              {/* Title */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Episode Title *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter episode title..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Brief description of the episode..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Content/Show Notes */}
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Show Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Detailed show notes, timestamps, links..."
                        rows={5}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Audio Upload/URL */}
              <div className="space-y-4">
                <Label>Audio File</Label>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Replace Audio File</Label>
                    <div className="mt-1">
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={handleAudioFileChange}
                        className="hidden"
                        id="audio-upload-edit"
                      />
                      <label htmlFor="audio-upload-edit">
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 sm:p-4 text-center cursor-pointer hover:border-gray-400 transition-colors">
                          <Upload className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                          <p className="text-sm text-gray-500">
                            {audioFile ? (
                              <span className="text-green-600 font-medium">
                                ✓ {audioFile.name}
                              </span>
                            ) : (
                              'Click to replace audio file'
                            )}
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div>
                    <FormField
                      control={form.control}
                      name="audioUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm text-muted-foreground">
                            Or Update Audio URL
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://example.com/audio.mp3"
                              disabled={!!audioFile}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Current audio info */}
                {!audioFile && episode.audioUrl && (
                  <div className="text-xs text-muted-foreground bg-muted/50 p-2 sm:p-3 rounded">
                    <strong>Current:</strong>
                    <span className="break-all ml-1">{episode.audioUrl}</span>
                  </div>
                )}
              </div>

              {/* Image Upload/URL */}
              <div className="space-y-4">
                <Label>Episode Artwork</Label>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Replace Image</Label>
                    <div className="mt-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileChange}
                        className="hidden"
                        id="image-upload-edit"
                      />
                      <label htmlFor="image-upload-edit">
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 sm:p-4 text-center cursor-pointer hover:border-gray-400 transition-colors">
                          <Upload className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                          <p className="text-sm text-gray-500">
                            {imageFile ? (
                              <span className="text-green-600 font-medium">
                                ✓ {imageFile.name}
                              </span>
                            ) : (
                              'Click to replace image'
                            )}
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div>
                    <FormField
                      control={form.control}
                      name="imageUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm text-muted-foreground">
                            Or Update Image URL
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://example.com/artwork.jpg"
                              disabled={!!imageFile}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Current image preview */}
                {!imageFile && episode.imageUrl && (
                  <div className="flex items-center space-x-3 bg-muted/20 p-2 sm:p-3 rounded">
                    <img
                      src={episode.imageUrl}
                      alt="Current artwork"
                      className="w-12 h-12 sm:w-16 sm:h-16 rounded object-cover flex-shrink-0"
                    />
                    <div className="text-xs text-muted-foreground min-w-0">
                      <strong>Current artwork</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Video Upload/URL */}
              <div className="space-y-4">
                <Label>Video File (Optional)</Label>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Upload Video</Label>
                    <div className="mt-1">
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleVideoFileChange}
                        className="hidden"
                        id="video-upload-edit"
                      />
                      <label htmlFor="video-upload-edit">
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 sm:p-4 text-center cursor-pointer hover:border-gray-400 transition-colors">
                          <Upload className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                          <p className="text-sm text-gray-500">
                            {videoFile ? (
                              <span className="text-green-600 font-medium">
                                ✓ {videoFile.name}
                              </span>
                            ) : (
                              'Click to upload video'
                            )}
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div>
                    <FormField
                      control={form.control}
                      name="videoUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm text-muted-foreground">
                            Or Video URL
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://example.com/video.mp4"
                              disabled={!!videoFile}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {!videoFile && episode.videoUrl && (
                  <div className="text-xs text-muted-foreground bg-muted/50 p-2 sm:p-3 rounded">
                    <strong>Current:</strong>
                    <span className="break-all ml-1">{episode.videoUrl}</span>
                  </div>
                )}
              </div>

              {/* Transcript Upload/URL */}
              <div className="space-y-4">
                <Label>Transcript (Optional)</Label>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Upload Transcript</Label>
                    <div className="mt-1">
                      <input
                        type="file"
                        accept=".txt,.html,.vtt,.json,.srt"
                        onChange={handleTranscriptFileChange}
                        className="hidden"
                        id="transcript-upload-edit"
                      />
                      <label htmlFor="transcript-upload-edit">
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 sm:p-4 text-center cursor-pointer hover:border-gray-400 transition-colors">
                          <Upload className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                          <p className="text-sm text-gray-500">
                            {transcriptFile ? (
                              <span className="text-green-600 font-medium">
                                ✓ {transcriptFile.name}
                              </span>
                            ) : (
                              'TXT, HTML, VTT, JSON, or SRT'
                            )}
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <FormField
                      control={form.control}
                      name="transcriptUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm text-muted-foreground">
                            Or Transcript URL
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://example.com/transcript.txt"
                              disabled={!!transcriptFile}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="transcriptType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm text-muted-foreground">Type</FormLabel>
                          <FormControl>
                            <select
                              {...field}
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={!!transcriptFile}
                            >
                              <option value="text/plain">Text (Plain)</option>
                              <option value="text/html">HTML</option>
                              <option value="text/vtt">WebVTT</option>
                              <option value="application/json">JSON</option>
                              <option value="application/x-subrip">SRT (SubRip)</option>
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {!transcriptFile && episode.transcriptUrl && (
                  <div className="text-xs text-muted-foreground bg-muted/50 p-2 sm:p-3 rounded">
                    <strong>Current:</strong>
                    <span className="break-all ml-1">{episode.transcriptUrl}</span>
                  </div>
                )}
              </div>

              {/* Chapters Upload/URL */}
              <div className="space-y-4">
                <Label>Chapters (Optional)</Label>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Upload Chapters</Label>
                    <div className="mt-1">
                      <input
                        type="file"
                        accept=".json,application/json"
                        onChange={handleChaptersFileChange}
                        className="hidden"
                        id="chapters-upload-edit"
                      />
                      <label htmlFor="chapters-upload-edit">
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 sm:p-4 text-center cursor-pointer hover:border-gray-400 transition-colors">
                          <Upload className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                          <p className="text-sm text-gray-500">
                            {chaptersFile ? (
                              <span className="text-green-600 font-medium">
                                ✓ {chaptersFile.name}
                              </span>
                            ) : (
                              'JSON chapters file'
                            )}
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div>
                    <FormField
                      control={form.control}
                      name="chaptersUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm text-muted-foreground">
                            Or Chapters URL
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://example.com/chapters.json"
                              disabled={!!chaptersFile}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {!chaptersFile && episode.chaptersUrl && (
                  <div className="text-xs text-muted-foreground bg-muted/50 p-2 sm:p-3 rounded">
                    <strong>Current:</strong>
                    <span className="break-all ml-1">{episode.chaptersUrl}</span>
                  </div>
                )}
              </div>

              {/* Episode Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <FormField
                  control={form.control}
                  name="episodeNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Episode Number</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="1"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="seasonNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Season Number</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="1"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (seconds)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="3600"
                          disabled={isDetectingDuration}
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        />
                      </FormControl>
                      {isDetectingDuration && (
                        <p className="text-sm text-muted-foreground">Detecting duration...</p>
                      )}
                      {field.value && (
                        <p className="text-sm text-muted-foreground">
                          Duration: {formatDurationHuman(field.value)}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Tags */}
              <div className="space-y-3">
                <Label>Tags</Label>
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                  <Input
                    value={currentTag}
                    onChange={(e) => setCurrentTag(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Add a tag..."
                    className="flex-1"
                  />
                  <Button type="button" onClick={addTag} variant="outline" className="w-full sm:w-auto">
                    Add
                  </Button>
                </div>

                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        #{tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="ml-1 hover:text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Explicit Content */}
              <FormField
                control={form.control}
                name="explicit"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Explicit Content</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Mark if this episode contains explicit content
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Form Actions */}
              <div className="flex flex-col-reverse sm:flex-row justify-end space-y-reverse space-y-2 sm:space-y-0 sm:space-x-3 pt-4 sm:pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isPending}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Update Episode
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}