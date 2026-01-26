import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Upload, X, Plus, Loader2, CheckCircle, AlertCircle, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePublishEpisode } from '@/hooks/usePublishEpisode';
import { usePodcastEpisodes } from '@/hooks/usePodcastEpisodes';
import { usePodcastConfig } from '@/hooks/usePodcastConfig';
import { useToast } from '@/hooks/useToast';
import { isPodcastCreator } from '@/lib/podcastConfig';
import { getAudioDuration, formatDurationHuman } from '@/lib/audioDuration';
import { cn } from '@/lib/utils';
import { ValueRecipientsEditor } from '@/components/podcast/ValueRecipientsEditor';
import type { EpisodeFormData, EpisodeValue } from '@/types/podcast';

const episodeSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(1000, 'Description too long'),
  content: z.string().optional(),
  audioUrl: z.string().url().optional().or(z.literal('')),
  imageUrl: z.string().url().optional().or(z.literal('')),
  duration: z.number().positive().optional(),
  episodeNumber: z.number().positive().optional(),
  seasonNumber: z.number().positive().optional(),
  explicit: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  publishDate: z.date().optional(),
});

type EpisodeFormValues = z.infer<typeof episodeSchema>;

interface PublishEpisodeFormProps {
  onSuccess?: (episodeId: string) => void;
  onCancel?: () => void;
  className?: string;
}

export function PublishEpisodeForm({ 
  onSuccess, 
  onCancel, 
  className 
}: PublishEpisodeFormProps) {
  const { user } = useCurrentUser();
  const { mutateAsync: publishEpisode } = usePublishEpisode();
  const { data: existingEpisodes } = usePodcastEpisodes();
  const podcastConfig = usePodcastConfig();
  const { toast } = useToast();
  
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [currentTag, setCurrentTag] = useState('');
  const [isDetectingDuration, setIsDetectingDuration] = useState(false);
  const [publishingState, setPublishingState] = useState<'idle' | 'uploading' | 'publishing' | 'success' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState<string>('');
  
  // Episode-level value splits state
  const [episodeValue, setEpisodeValue] = useState<EpisodeValue>({
    enabled: false,
    recipients: [],
  });

  // Calculate suggested next episode number
  const suggestedEpisodeNumber = existingEpisodes 
    ? Math.max(0, ...existingEpisodes.map(ep => ep.episodeNumber || 0)) + 1
    : 1;

  const form = useForm<EpisodeFormValues>({
    resolver: zodResolver(episodeSchema),
    defaultValues: {
      title: '',
      description: '',
      content: '',
      audioUrl: '',
      imageUrl: '',
      explicit: false,
      tags: [],
      publishDate: undefined,
    },
  });

  // Auto-fill episode number when episodes load
  useEffect(() => {
    const currentEpisodeNumber = form.getValues('episodeNumber');
    if (!currentEpisodeNumber && suggestedEpisodeNumber > 0) {
      form.setValue('episodeNumber', suggestedEpisodeNumber);
    }
  }, [suggestedEpisodeNumber, form]);

  const { watch, setValue } = form;
  const tags = watch('tags');

  // Check if user is the creator
  if (!user || !isPodcastCreator(user.pubkey)) {
    return (
      <Card className={className}>
        <CardContent className="py-12 px-8 text-center">
          <p className="text-muted-foreground">
            Only the podcast creator can publish episodes.
          </p>
        </CardContent>
      </Card>
    );
  }

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

  const onSubmit = async (data: EpisodeFormValues) => {
    // Prevent double submissions
    if (publishingState !== 'idle') {
      return;
    }

    try {
      console.log('Form submission data:', data);
      console.log('Audio file:', audioFile);
      console.log('Image file:', imageFile);
      
      // Validate that we have either audio file or URL
      if (!audioFile && !data.audioUrl) {
        toast({
          title: 'Audio required',
          description: 'Please provide either an audio file or audio URL.',
          variant: 'destructive',
        });
        return;
      }

      // Start the publishing process - show uploading state if we have files
      const hasFilesToUpload = audioFile || imageFile;
      if (hasFilesToUpload) {
        setPublishingState('uploading');
        const filesToUpload = [audioFile?.name, imageFile?.name].filter(Boolean).join(', ');
        setUploadProgress(`Uploading ${filesToUpload}...`);
      } else {
        setPublishingState('publishing');
        setUploadProgress('Publishing episode...');
      }
      
      const episodeData: EpisodeFormData = {
        ...data,
        audioFile: audioFile || undefined,
        imageFile: imageFile || undefined,
        // Clean up empty URL strings
        audioUrl: data.audioUrl || undefined,
        imageUrl: data.imageUrl || undefined,
        publishDate: data.publishDate || undefined,
        // Include per-episode value splits (only if enabled with recipients)
        value: episodeValue.enabled && episodeValue.recipients.length > 0 ? episodeValue : undefined,
      };

      console.log('Publishing episode data:', episodeData);
      
      // Note: The actual upload happens inside publishEpisode
      // We can't easily track upload vs publish phases separately without refactoring the hook
      // But we show "uploading" initially if there are files, which gives better feedback
      const episodeId = await publishEpisode(episodeData);
      
      // Success state
      setPublishingState('success');
      setUploadProgress('Episode published successfully!');
      
      toast({
        title: 'Episode published!',
        description: 'Your podcast episode has been published successfully.',
      });

      // Wait a moment to show success state, then reset
      setTimeout(() => {
        setPublishingState('idle');
        setUploadProgress('');
        onSuccess?.(episodeId);
        
        // Reset form
        form.reset();
        setAudioFile(null);
        setImageFile(null);
        setCurrentTag('');
        setEpisodeValue({ enabled: false, recipients: [] });
      }, 2000);
      
    } catch (error) {
      console.error('Episode publish error:', error);
      
      // Extract error message
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      
      // Determine if this was an upload error or publish error based on the message
      const isUploadError = errorMessage.toLowerCase().includes('upload') || 
                           errorMessage.toLowerCase().includes('blossom') ||
                           errorMessage.toLowerCase().includes('file');
      
      setPublishingState('error');
      setUploadProgress(isUploadError 
        ? `Upload failed: ${errorMessage}` 
        : `Publishing failed: ${errorMessage}`
      );
      
      toast({
        title: isUploadError ? 'Upload failed' : 'Failed to publish episode',
        description: errorMessage,
        variant: 'destructive',
      });

      // Keep error visible longer so user can read it, then reset
      setTimeout(() => {
        setPublishingState('idle');
        setUploadProgress('');
      }, 5000);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Publish New Episode</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
              <Label>Audio File *</Label>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Upload Audio File</Label>
                  <div className="mt-1">
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleAudioFileChange}
                      className="hidden"
                      id="audio-upload"
                    />
                    <label htmlFor="audio-upload">
                      <div className={cn(
                        "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
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
                                Ready to upload on publish
                              </span>
                            </span>
                          ) : (
                            <span className="text-gray-500">Click to upload audio file</span>
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
                          Or Enter Audio URL
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
            </div>

            {/* Image Upload/URL */}
            <div className="space-y-4">
              <Label>Episode Artwork (Optional)</Label>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Upload Image</Label>
                  <div className="mt-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileChange}
                      className="hidden"
                      id="image-upload"
                    />
                    <label htmlFor="image-upload">
                      <div className={cn(
                        "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
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
                                Ready to upload on publish
                              </span>
                            </span>
                          ) : (
                            <span className="text-gray-500">Click to upload image</span>
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
                          Or Enter Image URL
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
            </div>

            {/* Episode Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="episodeNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Episode Number</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder={suggestedEpisodeNumber.toString()}
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Auto-suggested: {suggestedEpisodeNumber}
                    </p>
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
                              <span>Today (default)</span>
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
                      Backdate for older episodes
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
              <div className="flex space-x-2">
                <Input
                  value={currentTag}
                  onChange={(e) => setCurrentTag(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Add a tag..."
                  className="flex-1"
                />
                <Button type="button" onClick={addTag} variant="outline">
                  <Plus className="w-4 h-4" />
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
              disabled={publishingState === 'uploading' || publishingState === 'publishing'}
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
            {publishingState !== 'idle' && (
              <div className={cn(
                "rounded-lg p-4 border",
                publishingState === 'error' 
                  ? "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800" 
                  : "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700"
              )}>
                <div className="flex items-start space-x-3">
                  {publishingState === 'uploading' || publishingState === 'publishing' ? (
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600 flex-shrink-0 mt-0.5" />
                  ) : publishingState === 'success' ? (
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : publishingState === 'error' ? (
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  ) : null}
                  
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-medium break-words",
                      publishingState === 'success' && "text-green-800 dark:text-green-400",
                      publishingState === 'error' && "text-red-800 dark:text-red-400",
                      (publishingState === 'uploading' || publishingState === 'publishing') && "text-gray-800 dark:text-gray-200"
                    )}>
                      {uploadProgress}
                    </p>
                    {publishingState === 'uploading' && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        This may take a moment for larger files...
                      </p>
                    )}
                    {publishingState === 'publishing' && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Broadcasting to Nostr relays...
                      </p>
                    )}
                    {publishingState === 'success' && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                        Your episode is now live!
                      </p>
                    )}
                    {publishingState === 'error' && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        Check your Blossom server settings or try a different media server.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex justify-end space-x-3">
              {onCancel && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={onCancel}
                  disabled={publishingState === 'uploading' || publishingState === 'publishing'}
                >
                  Cancel
                </Button>
              )}
              <Button 
                type="submit" 
                disabled={publishingState === 'uploading' || publishingState === 'publishing' || publishingState === 'success'}
              >
                {publishingState === 'uploading' && (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                )}
                {publishingState === 'publishing' && (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Publishing...
                  </>
                )}
                {publishingState === 'success' && (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Published!
                  </>
                )}
                {(publishingState === 'idle' || publishingState === 'error') && 'Publish Episode'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}