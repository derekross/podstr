import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Upload, Save, Loader2, CalendarIcon, CheckCircle, AlertCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useUpdateEpisode } from '@/hooks/usePublishEpisode';
import { usePodcastConfig } from '@/hooks/usePodcastConfig';
import { useToast } from '@/hooks/useToast';
import { getAudioDuration, formatDurationHuman } from '@/lib/audioDuration';
import { cn } from '@/lib/utils';
import { ValueRecipientsEditor } from '@/components/podcast/ValueRecipientsEditor';
import type { PodcastEpisode, EpisodeFormData, EpisodeValue } from '@/types/podcast';

// Schema for episode editing (similar to publish but allows empty audio URLs for existing episodes)
const episodeEditSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  content: z.string().optional(),
  audioUrl: z.string().url().optional().or(z.literal('')),
  videoUrl: z.string().url().optional().or(z.literal('')),
  imageUrl: z.string().url().optional().or(z.literal('')),
  transcriptUrl: z.string().url().optional().or(z.literal('')),
  chaptersUrl: z.string().url().optional().or(z.literal('')),
  duration: z.number().positive().optional(),
  episodeNumber: z.number().positive().optional(),
  seasonNumber: z.number().positive().optional(),
  explicit: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  publishDate: z.date().optional(),
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
  const queryClient = useQueryClient();
  const { mutateAsync: updateEpisode } = useUpdateEpisode();
  const podcastConfig = usePodcastConfig();

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [chaptersFile, setChaptersFile] = useState<File | null>(null);
  const [currentTag, setCurrentTag] = useState('');
  const [isDetectingDuration, setIsDetectingDuration] = useState(false);

  const [updatingState, setUpdatingState] = useState<'idle' | 'uploading' | 'publishing' | 'success' | 'error'>('idle');
  const [updateProgress, setUpdateProgress] = useState<string>('');

  // Episode-level value splits state
  const [episodeValue, setEpisodeValue] = useState<EpisodeValue>(
    episode.value || { enabled: false, recipients: [] }
  );

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
      chaptersUrl: episode.chaptersUrl || '',
      duration: episode.duration,
      episodeNumber: episode.episodeNumber,
      seasonNumber: episode.seasonNumber,
      explicit: episode.explicit || false,
      tags: episode.tags || [],
      publishDate: episode.publishDate,
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
      chaptersUrl: episode.chaptersUrl || '',
      duration: episode.duration,
      episodeNumber: episode.episodeNumber,
      seasonNumber: episode.seasonNumber,
      explicit: episode.explicit || false,
      tags: episode.tags || [],
      publishDate: episode.publishDate,
    });
    setAudioFile(null);
    setVideoFile(null);
    setImageFile(null);
    setTranscriptFile(null);
    setChaptersFile(null);
    setCurrentTag('');
    setIsDetectingDuration(false);
    setUpdatingState('idle');
    setUpdateProgress('');
    setEpisodeValue(episode.value || { enabled: false, recipients: [] });
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

      toast({
        title: 'Transcript file selected',
        description: file.name,
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
    // Prevent double submissions
    if (updatingState !== 'idle') {
      return;
    }

    try {
      console.log('Starting episode update...');

      // Start the updating process - show uploading state if we have files
      const hasFilesToUpload = audioFile || videoFile || imageFile || transcriptFile || chaptersFile;
      if (hasFilesToUpload) {
        setUpdatingState('uploading');
        const filesToUpload = [audioFile?.name, videoFile?.name, imageFile?.name, transcriptFile?.name, chaptersFile?.name].filter(Boolean).join(', ');
        setUpdateProgress(`Uploading ${filesToUpload}...`);
      } else {
        setUpdatingState('publishing');
        setUpdateProgress('Updating episode...');
      }

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
        chaptersUrl: data.chaptersUrl || undefined,
        // Keep existing external references
        externalRefs: episode.externalRefs,
        // Include publish date (only if changed from original)
        publishDate: data.publishDate,
        // Include per-episode value splits (only if enabled with recipients)
        value: episodeValue.enabled && episodeValue.recipients.length > 0 ? episodeValue : undefined,
      };

      console.log('Calling updateEpisode with:', { episodeId: episode.eventId, episodeIdentifier: episode.identifier, episodeData });

      await updateEpisode({
        episodeId: episode.eventId,
        episodeIdentifier: episode.identifier,
        episodeData
      });

      console.log('UpdateEpisode completed successfully');

      // Success state
      setUpdatingState('success');
      setUpdateProgress('Episode updated successfully!');

      // Invalidate episode queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['episode'] });
      queryClient.invalidateQueries({ queryKey: ['podcast-episodes'] });
      queryClient.invalidateQueries({ queryKey: ['podcast-episode'] });

      toast({
        title: 'Episode updated!',
        description: 'Your episode has been updated successfully.',
      });

      // Wait a moment to show success state, then close
      setTimeout(() => {
        setUpdatingState('idle');
        setUpdateProgress('');
        onOpenChange(false);
        onSuccess();
      }, 1500);

    } catch (error) {
      console.error('Error in onSubmit:', error);
      
      // Extract error message
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      
      // Determine if this was an upload error or publish error
      const isUploadError = errorMessage.toLowerCase().includes('upload') || 
                           errorMessage.toLowerCase().includes('blossom') ||
                           errorMessage.toLowerCase().includes('file');
      
      setUpdatingState('error');
      setUpdateProgress(isUploadError 
        ? `Upload failed: ${errorMessage}` 
        : `Update failed: ${errorMessage}`
      );
      
      toast({
        title: isUploadError ? 'Upload failed' : 'Failed to update episode',
        description: errorMessage,
        variant: 'destructive',
      });

      // Keep error visible longer so user can read it
      setTimeout(() => {
        setUpdatingState('idle');
        setUpdateProgress('');
      }, 5000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] w-[95vw] sm:w-full sm:max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Edit Episode</DialogTitle>
          <DialogDescription>
            Update episode details, audio, artwork, and metadata.
          </DialogDescription>
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
                        <div className={cn(
                          "border-2 border-dashed rounded-lg p-3 sm:p-4 text-center cursor-pointer transition-colors",
                          audioFile 
                            ? "border-blue-400 bg-blue-50 dark:bg-blue-950 hover:border-blue-500" 
                            : "border-gray-300 hover:border-gray-400"
                        )}>
                          <Upload className={cn(
                            "w-6 h-6 mx-auto mb-2",
                            audioFile ? "text-blue-500" : "text-gray-400"
                          )} />
                          <p className="text-sm">
                            {audioFile ? (
                              <span className="text-blue-600 dark:text-blue-400 font-medium">
                                {audioFile.name}
                                <span className="block text-xs mt-1 text-muted-foreground">
                                  Ready to upload on save
                                </span>
                              </span>
                            ) : (
                              <span className="text-gray-500">Click to replace audio file</span>
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
                        <div className={cn(
                          "border-2 border-dashed rounded-lg p-3 sm:p-4 text-center cursor-pointer transition-colors",
                          imageFile 
                            ? "border-blue-400 bg-blue-50 dark:bg-blue-950 hover:border-blue-500" 
                            : "border-gray-300 hover:border-gray-400"
                        )}>
                          <Upload className={cn(
                            "w-6 h-6 mx-auto mb-2",
                            imageFile ? "text-blue-500" : "text-gray-400"
                          )} />
                          <p className="text-sm">
                            {imageFile ? (
                              <span className="text-blue-600 dark:text-blue-400 font-medium">
                                {imageFile.name}
                                <span className="block text-xs mt-1 text-muted-foreground">
                                  Ready to upload on save
                                </span>
                              </span>
                            ) : (
                              <span className="text-gray-500">Click to replace image</span>
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
                        <div className={cn(
                          "border-2 border-dashed rounded-lg p-3 sm:p-4 text-center cursor-pointer transition-colors",
                          videoFile 
                            ? "border-blue-400 bg-blue-50 dark:bg-blue-950 hover:border-blue-500" 
                            : "border-gray-300 hover:border-gray-400"
                        )}>
                          <Upload className={cn(
                            "w-6 h-6 mx-auto mb-2",
                            videoFile ? "text-blue-500" : "text-gray-400"
                          )} />
                          <p className="text-sm">
                            {videoFile ? (
                              <span className="text-blue-600 dark:text-blue-400 font-medium">
                                {videoFile.name}
                                <span className="block text-xs mt-1 text-muted-foreground">
                                  Ready to upload on save
                                </span>
                              </span>
                            ) : (
                              <span className="text-gray-500">Click to upload video</span>
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
                        <div className={cn(
                          "border-2 border-dashed rounded-lg p-3 sm:p-4 text-center cursor-pointer transition-colors",
                          transcriptFile 
                            ? "border-blue-400 bg-blue-50 dark:bg-blue-950 hover:border-blue-500" 
                            : "border-gray-300 hover:border-gray-400"
                        )}>
                          <Upload className={cn(
                            "w-6 h-6 mx-auto mb-2",
                            transcriptFile ? "text-blue-500" : "text-gray-400"
                          )} />
                          <p className="text-sm">
                            {transcriptFile ? (
                              <span className="text-blue-600 dark:text-blue-400 font-medium">
                                {transcriptFile.name}
                                <span className="block text-xs mt-1 text-muted-foreground">
                                  Ready to upload on save
                                </span>
                              </span>
                            ) : (
                              <span className="text-gray-500">TXT, HTML, VTT, JSON, or SRT</span>
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
                        <div className={cn(
                          "border-2 border-dashed rounded-lg p-3 sm:p-4 text-center cursor-pointer transition-colors",
                          chaptersFile 
                            ? "border-blue-400 bg-blue-50 dark:bg-blue-950 hover:border-blue-500" 
                            : "border-gray-300 hover:border-gray-400"
                        )}>
                          <Upload className={cn(
                            "w-6 h-6 mx-auto mb-2",
                            chaptersFile ? "text-blue-500" : "text-gray-400"
                          )} />
                          <p className="text-sm">
                            {chaptersFile ? (
                              <span className="text-blue-600 dark:text-blue-400 font-medium">
                                {chaptersFile.name}
                                <span className="block text-xs mt-1 text-muted-foreground">
                                  Ready to upload on save
                                </span>
                              </span>
                            ) : (
                              <span className="text-gray-500">JSON chapters file</span>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
                  name="publishDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Publish Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Original date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date > new Date()
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <p className="text-xs text-muted-foreground">
                        Change episode date
                      </p>
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

              {/* Per-Episode Value Splits */}
              <ValueRecipientsEditor
                value={episodeValue}
                onChange={setEpisodeValue}
                podcastDefaults={podcastConfig.podcast?.value ? {
                  amount: podcastConfig.podcast.value.amount,
                  currency: podcastConfig.podcast.value.currency,
                  recipients: podcastConfig.podcast.value.recipients,
                } : undefined}
                disabled={updatingState === 'uploading' || updatingState === 'publishing'}
              />

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

              {/* Progress Indicator */}
              {updatingState !== 'idle' && (
                <div className={cn(
                  "rounded-lg p-4 border",
                  updatingState === 'error' 
                    ? "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800" 
                    : "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                )}>
                  <div className="flex items-start space-x-3">
                    {updatingState === 'uploading' || updatingState === 'publishing' ? (
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600 flex-shrink-0 mt-0.5" />
                    ) : updatingState === 'success' ? (
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : updatingState === 'error' ? (
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    ) : null}
                    
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium break-words",
                        updatingState === 'success' && "text-green-800 dark:text-green-400",
                        updatingState === 'error' && "text-red-800 dark:text-red-400",
                        (updatingState === 'uploading' || updatingState === 'publishing') && "text-gray-800 dark:text-gray-200"
                      )}>
                        {updateProgress}
                      </p>
                      {updatingState === 'uploading' && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          This may take a moment for larger files...
                        </p>
                      )}
                      {updatingState === 'error' && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                          Check your Blossom server settings or try a different media server.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Form Actions */}
              <div className="flex flex-col-reverse sm:flex-row justify-end space-y-reverse space-y-2 sm:space-y-0 sm:space-x-3 pt-4 sm:pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={updatingState === 'uploading' || updatingState === 'publishing'}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updatingState === 'uploading' || updatingState === 'publishing' || updatingState === 'success'} 
                  className="w-full sm:w-auto"
                >
                  {updatingState === 'uploading' && (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  )}
                  {updatingState === 'publishing' && (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  )}
                  {updatingState === 'success' && (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Updated!
                    </>
                  )}
                  {(updatingState === 'idle' || updatingState === 'error') && (
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