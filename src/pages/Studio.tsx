import { useSeoMeta } from '@unhead/react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Settings,
  Save,
  X,
  Upload,
  Mic,
  Users,
  Zap,
  Loader2,
  User,
  DollarSign,
  Server,
  Play,
  MessageSquare,
  Repeat2,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Layout } from '@/components/Layout';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { usePodcastMetadata } from '@/hooks/usePodcastMetadata';
import { usePodcastConfig } from '@/hooks/usePodcastConfig';
import { usePodcastAnalytics } from '@/hooks/usePodcastAnalytics';
import { useRSSFeedGenerator } from '@/hooks/useRSSFeedGenerator';
import { useAuthor } from '@/hooks/useAuthor';
import { useUploadFile } from '@/hooks/useUploadFile';
import { isPodcastCreator, PODCAST_CONFIG, getCreatorPubkeyHex, PODCAST_KINDS } from '@/lib/podcastConfig';
import { genRSSFeed } from '@/lib/rssGenerator';
import { EpisodeManagement } from '@/components/studio/EpisodeManagement';
import { TrailerManagement } from '@/components/studio/TrailerManagement';
import { BlossomServerManager } from '@/components/studio/BlossomServerManager';
import { OP3Analytics } from '@/components/studio/OP3Analytics';

interface ProfileFormData {
  name: string;
  displayName: string;
  about: string;
  picture: string;
  website: string;
  lud16: string;
  nip05: string;
}

interface PodcastFormData {
  title: string;
  description: string;
  author: string;
  email: string;
  image: string;
  language: string;
  categories: string[];
  explicit: boolean;
  website: string;
  copyright: string;
  funding: string[];
  locked: boolean;
  value: {
    amount: number;
    currency: string;
    recipients?: Array<{
      name: string;
      type: 'node' | 'lnaddress';
      address: string;
      split: number;
      customKey?: string;
      customValue?: string;
      fee?: boolean;
    }>;
  };
  type: 'episodic' | 'serial';
  complete: boolean;
  // New Podcasting 2.0 fields
  guid: string;
  medium: 'podcast' | 'music' | 'video' | 'film' | 'audiobook' | 'newsletter' | 'blog';
  publisher: string;
  location?: {
    name: string;
    geo?: string;
    osm?: string;
  };
  person: Array<{
    name: string;
    role: string;
    group?: string;
    img?: string;
    href?: string;
  }>;
  license: {
    identifier: string;
    url?: string;
  };
  useOP3: boolean;
}

interface ExtendedPodcastMetadata {
  title: string;
  description: string;
  author: string;
  email: string;
  image: string;
  language: string;
  categories: string[];
  explicit: boolean;
  website: string;
  copyright: string;
  funding?: string[];
  locked?: boolean;
  value?: {
    amount: number;
    currency: string;
    recipients?: Array<{
      name: string;
      type: 'node' | 'lnaddress';
      address: string;
      split: number;
      customKey?: string;
      customValue?: string;
      fee?: boolean;
    }>;
  };
  type?: 'episodic' | 'serial';
  complete?: boolean;
  // Podcasting 2.0 fields
  guid?: string;
  medium?: 'podcast' | 'music' | 'video' | 'film' | 'audiobook' | 'newsletter' | 'blog';
  publisher?: string;
  location?: {
    name: string;
    geo?: string;
    osm?: string;
  };
  person?: Array<{
    name: string;
    role: string;
    group?: string;
    img?: string;
    href?: string;
  }>;
  license?: {
    identifier: string;
    url?: string;
  };
  useOP3?: boolean;
}

const Studio = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const { mutateAsync: createEvent } = useNostrPublish();
  const { toast } = useToast();
  const { data: podcastMetadata, isLoading: isLoadingMetadata } = usePodcastMetadata();
  const podcastConfig = usePodcastConfig();
  const { refetch: refetchRSSFeed } = useRSSFeedGenerator();
  const { data: creator } = useAuthor(getCreatorPubkeyHex());
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();
  const { data: analytics, isLoading: analyticsLoading } = usePodcastAnalytics();
  const isCreator = user && isPodcastCreator(user.pubkey);

  const [activeTab, setActiveTab] = useState('settings');
  const [isSaving, setIsSaving] = useState(false);
  const [editingSection, setEditingSection] = useState<'profile' | 'podcast' | null>(null);

  const [profileData, setProfileData] = useState<ProfileFormData>({
    name: '',
    displayName: '',
    about: '',
    picture: '',
    website: '',
    lud16: '',
    nip05: '',
  });

  const [formData, setFormData] = useState<PodcastFormData>({
    title: PODCAST_CONFIG.podcast.title,
    description: PODCAST_CONFIG.podcast.description,
    author: PODCAST_CONFIG.podcast.author,
    email: PODCAST_CONFIG.podcast.email,
    image: PODCAST_CONFIG.podcast.image,
    language: PODCAST_CONFIG.podcast.language,
    categories: PODCAST_CONFIG.podcast.categories,
    explicit: PODCAST_CONFIG.podcast.explicit,
    website: PODCAST_CONFIG.podcast.website,
    copyright: PODCAST_CONFIG.podcast.copyright,
    funding: PODCAST_CONFIG.podcast.funding || [],
    locked: PODCAST_CONFIG.podcast.locked,
    value: {
      amount: PODCAST_CONFIG.podcast.value.amount,
      currency: PODCAST_CONFIG.podcast.value.currency,
      recipients: PODCAST_CONFIG.podcast.value.recipients || []
    },
    type: PODCAST_CONFIG.podcast.type,
    complete: PODCAST_CONFIG.podcast.complete,
    // New Podcasting 2.0 defaults
    guid: PODCAST_CONFIG.podcast.guid || PODCAST_CONFIG.creatorNpub,
    medium: PODCAST_CONFIG.podcast.medium || 'podcast',
    publisher: PODCAST_CONFIG.podcast.publisher || PODCAST_CONFIG.podcast.author,
    person: PODCAST_CONFIG.podcast.person || [
      {
        name: PODCAST_CONFIG.podcast.author,
        role: 'host',
        group: 'cast'
      }
    ],
    license: PODCAST_CONFIG.podcast.license || {
      identifier: 'CC BY 4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/'
    },
    useOP3: PODCAST_CONFIG.podcast.useOP3 || false
  });

  // Update form data when metadata loads
  useEffect(() => {
    if (podcastMetadata && !isLoadingMetadata) {
      setFormData({
        title: podcastMetadata.title,
        description: podcastMetadata.description,
        author: podcastMetadata.author,
        email: podcastMetadata.email,
        image: podcastMetadata.image,
        language: podcastMetadata.language,
        categories: podcastMetadata.categories,
        explicit: podcastMetadata.explicit,
        website: podcastMetadata.website,
        copyright: podcastMetadata.copyright,
        funding: podcastMetadata.funding || PODCAST_CONFIG.podcast.funding || [],
        locked: podcastMetadata.locked ?? PODCAST_CONFIG.podcast.locked,
        value: podcastMetadata.value || {
          amount: PODCAST_CONFIG.podcast.value.amount,
          currency: PODCAST_CONFIG.podcast.value.currency,
          recipients: PODCAST_CONFIG.podcast.value.recipients || []
        },
        type: podcastMetadata.type || PODCAST_CONFIG.podcast.type,
        complete: podcastMetadata.complete ?? PODCAST_CONFIG.podcast.complete,
        // Podcasting 2.0 fields
        guid: (podcastMetadata as ExtendedPodcastMetadata).guid || PODCAST_CONFIG.creatorNpub,
        medium: (podcastMetadata as ExtendedPodcastMetadata).medium || 'podcast',
        publisher: (podcastMetadata as ExtendedPodcastMetadata).publisher || podcastMetadata.author,
        location: (podcastMetadata as ExtendedPodcastMetadata).location,
        person: (podcastMetadata as ExtendedPodcastMetadata).person || [
          {
            name: podcastMetadata.author,
            role: 'host',
            group: 'cast'
          }
        ],
        license: (podcastMetadata as ExtendedPodcastMetadata).license || {
          identifier: 'CC BY 4.0',
          url: 'https://creativecommons.org/licenses/by/4.0/'
        },
        useOP3: (podcastMetadata as ExtendedPodcastMetadata).useOP3 || false
      });
    }
  }, [podcastMetadata, isLoadingMetadata]);

  // Update profile data when creator data loads
  useEffect(() => {
    if (creator?.metadata) {
      setProfileData({
        name: creator.metadata.name || '',
        displayName: creator.metadata.display_name || '',
        about: creator.metadata.about || '',
        picture: creator.metadata.picture || '',
        website: creator.metadata.website || '',
        lud16: creator.metadata.lud16 || '',
        nip05: creator.metadata.nip05 || '',
      });
    }
  }, [creator]);

  useSeoMeta({
    title: 'Studio - PODSTR',
    description: 'Manage your podcast settings and publish new episodes',
  });

  const handleProfileInputChange = (field: keyof ProfileFormData, value: string) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleInputChange = (field: keyof PodcastFormData, value: PodcastFormData[keyof PodcastFormData]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCategoryAdd = (category: string) => {
    if (category && !formData.categories.includes(category)) {
      handleInputChange('categories', [...formData.categories, category]);
    }
  };

  const handleCategoryRemove = (category: string) => {
    handleInputChange('categories', formData.categories.filter(c => c !== category));
  };

  const handleFundingAdd = (funding: string) => {
    if (!funding) return;
    
    // Validate URL - allow both full URLs and relative paths
    const isValidUrl = funding.startsWith('/') || funding.startsWith('./') || funding.startsWith('../');
    if (!isValidUrl) {
      try {
        new URL(funding);
      } catch {
        toast({
          title: 'Invalid URL',
          description: 'Please enter a valid URL (e.g., https://example.com) or relative path (e.g., /about)',
          variant: 'destructive',
        });
        return;
      }
    }
    
    if (!formData.funding.includes(funding)) {
      handleInputChange('funding', [...formData.funding, funding]);
      toast({
        title: 'Funding link added',
        description: 'The funding link has been added successfully.',
      });
    }
  };

  const handleFundingRemove = (funding: string) => {
    handleInputChange('funding', formData.funding.filter(f => f !== funding));
  };

  const handleRecipientAdd = (recipient: { name: string; type: 'node' | 'lnaddress'; address: string; split: number; customKey?: string; customValue?: string; fee?: boolean }) => {
    if (recipient.name && recipient.address) {
      const currentRecipients = formData.value.recipients || [];
      handleInputChange('value', {
        ...formData.value,
        recipients: [...currentRecipients, recipient]
      });
    }
  };

  const handleRecipientRemove = (index: number) => {
    const currentRecipients = formData.value.recipients || [];
    handleInputChange('value', {
      ...formData.value,
      recipients: currentRecipients.filter((_, i) => i !== index)
    });
  };

  const handleRecipientUpdate = (index: number, field: string, value: string | number | boolean) => {
    const currentRecipients = formData.value.recipients || [];
    const updatedRecipients = [...currentRecipients];
    updatedRecipients[index] = {
      ...updatedRecipients[index],
      [field]: value
    };
    handleInputChange('value', {
      ...formData.value,
      recipients: updatedRecipients
    });
  };

  // Handle file uploads for profile picture
  const uploadProfilePicture = async (file: File) => {
    try {
      const [[_, url]] = await uploadFile(file);
      handleProfileInputChange('picture', url);
      toast({
        title: 'Success',
        description: 'Profile picture uploaded successfully',
      });
    } catch (error) {
      console.error('Failed to upload profile picture:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload profile picture. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Handle file uploads for podcast image
  const uploadPodcastImage = async (file: File) => {
    try {
      const [[_, url]] = await uploadFile(file);
      handleInputChange('image', url);
      toast({
        title: 'Success',
        description: 'Podcast cover image uploaded successfully',
      });
    } catch (error) {
      console.error('Failed to upload podcast image:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload podcast cover image. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save profile metadata if profile section is being edited
      if (editingSection === 'profile') {
        const profileEvent = {
          kind: 0, // Profile metadata
          content: JSON.stringify({
            name: profileData.name,
            display_name: profileData.displayName,
            about: profileData.about,
            picture: profileData.picture,
            website: profileData.website,
            lud16: profileData.lud16,
            nip05: profileData.nip05,
          }),
          tags: [],
          created_at: Math.floor(Date.now() / 1000)
        };

        await createEvent(profileEvent);
      }

      // Save podcast metadata if podcast section is being edited
      if (editingSection === 'podcast') {
        // Convert relative funding URLs to absolute URLs for external consumption
        const getBaseUrl = () => {
          if (typeof window !== 'undefined') {
            return window.location.origin;
          }
          return process.env.BASE_URL || 'https://podstr.example';
        };
        
        const baseUrl = getBaseUrl();
        const absoluteFundingUrls = formData.funding.map(funding => {
          // Convert relative URLs to absolute URLs
          if (funding.startsWith('/') || funding.startsWith('./') || funding.startsWith('../')) {
            return `${baseUrl}${funding.startsWith('/') ? funding : '/' + funding.replace(/^\.\//, '')}`;
          }
          return funding;
        });

        const podcastMetadataEvent = {
          kind: PODCAST_KINDS.PODCAST_METADATA, // Addressable podcast metadata event
          content: JSON.stringify({
            title: formData.title,
            description: formData.description,
            author: formData.author,
            email: formData.email,
            image: formData.image,
            language: formData.language,
            categories: formData.categories,
            explicit: formData.explicit,
            website: formData.website,
            copyright: formData.copyright,
            funding: absoluteFundingUrls,
            locked: formData.locked,
            value: formData.value,
            type: formData.type,
            complete: formData.complete,
            // Podcasting 2.0 fields
            guid: formData.guid,
            medium: formData.medium,
            publisher: formData.publisher,
            location: formData.location,
            person: formData.person,
            license: formData.license,
            useOP3: formData.useOP3,
            updated_at: Math.floor(Date.now() / 1000)
          }),
          tags: [
            ['d', 'podcast-metadata'], // Identifier for this type of event
            ['title', formData.title]
          ],
          created_at: Math.floor(Date.now() / 1000)
        };

        await createEvent(podcastMetadataEvent);

        // Invalidate podcast metadata cache to force refetch with new data
        queryClient.invalidateQueries({ queryKey: ['podcast-metadata'] });

        // Update RSS feed with the new configuration (non-blocking)
        try {
          await Promise.race([
            genRSSFeed(undefined, podcastConfig),
            new Promise((_, reject) => setTimeout(() => reject(new Error('RSS generation timeout')), 5000))
          ]);
          console.log('RSS feed updated successfully');
        } catch (error) {
          console.warn('RSS feed update failed or timed out, but settings were saved:', error);
        }

        // Refetch RSS feed generator (non-blocking)
        try {
          await Promise.race([
            refetchRSSFeed(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('RSS refetch timeout')), 3000))
          ]);
        } catch (error) {
          console.warn('RSS refetch failed or timed out, but settings were saved:', error);
        }
      }

      toast({
        title: "Settings saved!",
        description: `${editingSection === 'profile' ? 'Profile' : 'Podcast'} settings have been updated.`,
      });

      setEditingSection(null);
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast({
        title: "Failed to save settings",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (editingSection === 'profile' && creator?.metadata) {
      setProfileData({
        name: creator.metadata.name || '',
        displayName: creator.metadata.display_name || '',
        about: creator.metadata.about || '',
        picture: creator.metadata.picture || '',
        website: creator.metadata.website || '',
        lud16: creator.metadata.lud16 || '',
        nip05: creator.metadata.nip05 || '',
      });
    }

    if (editingSection === 'podcast' && podcastMetadata) {
      setFormData({
        title: podcastMetadata.title,
        description: podcastMetadata.description,
        author: podcastMetadata.author,
        email: podcastMetadata.email,
        image: podcastMetadata.image,
        language: podcastMetadata.language,
        categories: podcastMetadata.categories,
        explicit: podcastMetadata.explicit,
        website: podcastMetadata.website,
        copyright: podcastMetadata.copyright,
        funding: podcastMetadata.funding || PODCAST_CONFIG.podcast.funding || [],
        locked: podcastMetadata.locked ?? PODCAST_CONFIG.podcast.locked,
        value: podcastMetadata.value || {
          amount: PODCAST_CONFIG.podcast.value.amount,
          currency: PODCAST_CONFIG.podcast.value.currency,
          recipients: PODCAST_CONFIG.podcast.value.recipients || []
        },
        type: podcastMetadata.type || PODCAST_CONFIG.podcast.type,
        complete: podcastMetadata.complete ?? PODCAST_CONFIG.podcast.complete,
        // Podcasting 2.0 fields
        guid: (podcastMetadata as ExtendedPodcastMetadata).guid || PODCAST_CONFIG.creatorNpub,
        medium: (podcastMetadata as ExtendedPodcastMetadata).medium || 'podcast',
        publisher: (podcastMetadata as ExtendedPodcastMetadata).publisher || podcastMetadata.author,
        location: (podcastMetadata as ExtendedPodcastMetadata).location,
        person: (podcastMetadata as ExtendedPodcastMetadata).person || [
          {
            name: podcastMetadata.author,
            role: 'host',
            group: 'cast'
          }
        ],
        license: (podcastMetadata as ExtendedPodcastMetadata).license || {
          identifier: 'CC BY 4.0',
          url: 'https://creativecommons.org/licenses/by/4.0/'
        },
        useOP3: (podcastMetadata as ExtendedPodcastMetadata).useOP3 || false
      });
    }

    setEditingSection(null);
  };

  if (!user) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardContent className="p-6 text-center">
              <h2 className="text-xl font-semibold mb-4">Login Required</h2>
              <p className="text-muted-foreground mb-4">
                You need to be logged in to access the Studio.
              </p>
              <Button onClick={() => navigate('/')}>
                Go to Homepage
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (!isCreator) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardContent className="p-6 text-center">
              <h2 className="text-xl font-semibold mb-4">Access Denied</h2>
              <p className="text-muted-foreground mb-4">
                Only the podcast creator can access the Studio.
              </p>
              <Button onClick={() => navigate('/')}>
                Go to Homepage
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">Studio</h1>
              <p className="text-muted-foreground">
                Manage your profile and podcast settings
              </p>
            </div>

            {editingSection ? (
              <div className="flex items-center space-x-2">
                <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving || isUploading}>
                  {(isSaving || isUploading) ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save {editingSection === 'profile' ? 'Profile' : 'Podcast'}
                </Button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setEditingSection('profile')}
                  disabled={editingSection === 'podcast'}
                >
                  <User className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
                <Button
                  onClick={() => setEditingSection('podcast')}
                  disabled={editingSection === 'profile'}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Edit Podcast
                </Button>
              </div>
            )}
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="settings" className="flex items-center space-x-2">
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </TabsTrigger>
              <TabsTrigger value="episodes" className="flex items-center space-x-2">
                <Mic className="w-4 h-4" />
                <span>Episodes</span>
              </TabsTrigger>
              <TabsTrigger value="trailers" className="flex items-center space-x-2">
                <Play className="w-4 h-4" />
                <span>Trailers</span>
              </TabsTrigger>
              <TabsTrigger value="blossom" className="flex items-center space-x-2">
                <Server className="w-4 h-4" />
                <span>Media Servers</span>
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center space-x-2">
                <Zap className="w-4 h-4" />
                <span>Analytics</span>
              </TabsTrigger>
            </TabsList>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-6">
              {/* Profile Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <User className="w-5 h-5" />
                    <span>Profile Settings</span>
                    {editingSection === 'profile' && (
                      <Badge variant="secondary">Editing</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="profile-name">Name</Label>
                        <Input
                          id="profile-name"
                          value={profileData.name}
                          onChange={(e) => handleProfileInputChange('name', e.target.value)}
                          disabled={editingSection !== 'profile'}
                          placeholder="Your full name"
                        />
                      </div>

                      <div>
                        <Label htmlFor="profile-display-name">Display Name</Label>
                        <Input
                          id="profile-display-name"
                          value={profileData.displayName}
                          onChange={(e) => handleProfileInputChange('displayName', e.target.value)}
                          disabled={editingSection !== 'profile'}
                          placeholder="How you want to be known"
                        />
                      </div>

                      <div>
                        <Label htmlFor="profile-website">Website</Label>
                        <Input
                          id="profile-website"
                          value={profileData.website}
                          onChange={(e) => handleProfileInputChange('website', e.target.value)}
                          disabled={editingSection !== 'profile'}
                          placeholder="https://yourwebsite.com"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="profile-picture">Profile Picture</Label>
                        <div className="space-y-2">
                          <Input
                            id="profile-picture"
                            value={profileData.picture}
                            onChange={(e) => handleProfileInputChange('picture', e.target.value)}
                            disabled={editingSection !== 'profile'}
                            placeholder="https://example.com/avatar.jpg"
                          />
                          <div className="flex items-center space-x-2">
                            <input 
                              type="file" 
                              id="profile-picture-upload"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  uploadProfilePicture(file);
                                }
                              }}
                              disabled={editingSection !== 'profile'}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => document.getElementById('profile-picture-upload')?.click()}
                              disabled={editingSection !== 'profile' || isUploading}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              {isUploading ? 'Uploading...' : 'Upload Image'}
                            </Button>
                            {profileData.picture && (
                              <div className="h-10 w-10 rounded-full overflow-hidden">
                                <img 
                                  src={profileData.picture} 
                                  alt="Profile preview" 
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="profile-lud16">Lightning Address (lud16)</Label>
                        <Input
                          id="profile-lud16"
                          value={profileData.lud16}
                          onChange={(e) => handleProfileInputChange('lud16', e.target.value)}
                          disabled={editingSection !== 'profile'}
                          placeholder="name@domain.com"
                        />
                      </div>

                      <div>
                        <Label htmlFor="profile-nip05">Nostr Address (nip05)</Label>
                        <Input
                          id="profile-nip05"
                          value={profileData.nip05}
                          onChange={(e) => handleProfileInputChange('nip05', e.target.value)}
                          disabled={editingSection !== 'profile'}
                          placeholder="name@domain.com"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="profile-about">About</Label>
                    <Textarea
                      id="profile-about"
                      value={profileData.about}
                      onChange={(e) => handleProfileInputChange('about', e.target.value)}
                      disabled={editingSection !== 'profile'}
                      placeholder="Tell us about yourself"
                      rows={4}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Podcast Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Mic className="w-5 h-5" />
                    <span>Podcast Settings</span>
                    {editingSection === 'podcast' && (
                      <Badge variant="secondary">Editing</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Basic Information */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="title">Podcast Title</Label>
                        <Input
                          id="title"
                          value={formData.title}
                          onChange={(e) => handleInputChange('title', e.target.value)}
                          disabled={editingSection !== 'podcast'}
                          placeholder="Enter podcast title"
                        />
                      </div>

                      <div>
                        <Label htmlFor="author">Author/Host</Label>
                        <Input
                          id="author"
                          value={formData.author}
                          onChange={(e) => handleInputChange('author', e.target.value)}
                          disabled={editingSection !== 'podcast'}
                          placeholder="Enter author name"
                        />
                      </div>

                      <div>
                        <Label htmlFor="email">Contact Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          disabled={editingSection !== 'podcast'}
                          placeholder="Enter contact email"
                        />
                      </div>

                      <div>
                        <Label htmlFor="language">Language</Label>
                        <Input
                          id="language"
                          value={formData.language}
                          onChange={(e) => handleInputChange('language', e.target.value)}
                          disabled={editingSection !== 'podcast'}
                          placeholder="e.g., en-us"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="website">Website</Label>
                        <Input
                          id="website"
                          value={formData.website}
                          onChange={(e) => handleInputChange('website', e.target.value)}
                          disabled={editingSection !== 'podcast'}
                          placeholder="https://example.com"
                        />
                      </div>

                      <div>
                        <Label htmlFor="copyright">Copyright</Label>
                        <Input
                          id="copyright"
                          value={formData.copyright}
                          onChange={(e) => handleInputChange('copyright', e.target.value)}
                          disabled={editingSection !== 'podcast'}
                          placeholder="© 2025 Podcast Name"
                        />
                      </div>

                      <div>
                        <Label htmlFor="image">Cover Image</Label>
                        <div className="space-y-2">
                          <Input
                            id="image"
                            value={formData.image}
                            onChange={(e) => handleInputChange('image', e.target.value)}
                            disabled={editingSection !== 'podcast'}
                            placeholder="https://example.com/image.jpg"
                          />
                          <div className="flex items-center space-x-2">
                            <input 
                              type="file" 
                              id="podcast-image-upload"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  uploadPodcastImage(file);
                                }
                              }}
                              disabled={editingSection !== 'podcast'}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => document.getElementById('podcast-image-upload')?.click()}
                              disabled={editingSection !== 'podcast' || isUploading}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              {isUploading ? 'Uploading...' : 'Upload Image'}
                            </Button>
                            {formData.image && (
                              <div className="h-10 w-16 rounded overflow-hidden">
                                <img 
                                  src={formData.image} 
                                  alt="Podcast cover preview" 
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id="explicit"
                          checked={formData.explicit}
                          onCheckedChange={(checked) => handleInputChange('explicit', checked)}
                          disabled={editingSection !== 'podcast'}
                        />
                        <Label htmlFor="explicit">Explicit Content</Label>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      disabled={editingSection !== 'podcast'}
                      placeholder="Enter podcast description"
                      rows={4}
                    />
                  </div>

                  {/* Podcast 2.0 Advanced Settings */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="podcast-type">Podcast Type</Label>
                        <select
                          id="podcast-type"
                          value={formData.type}
                          onChange={(e) => handleInputChange('type', e.target.value)}
                          disabled={editingSection !== 'podcast'}
                          className="w-full p-2 border border-input bg-background text-foreground rounded-md focus:ring-2 focus:ring-ring focus:border-ring disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="episodic">Episodic</option>
                          <option value="serial">Serial</option>
                        </select>
                      </div>

                      <div>
                        <Label htmlFor="medium">Medium</Label>
                        <select
                          id="medium"
                          value={formData.medium}
                          onChange={(e) => handleInputChange('medium', e.target.value)}
                          disabled={editingSection !== 'podcast'}
                          className="w-full p-2 border border-input bg-background text-foreground rounded-md focus:ring-2 focus:ring-ring focus:border-ring disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="podcast">Podcast</option>
                          <option value="music">Music</option>
                          <option value="video">Video</option>
                          <option value="film">Film</option>
                          <option value="audiobook">Audiobook</option>
                          <option value="newsletter">Newsletter</option>
                          <option value="blog">Blog</option>
                        </select>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id="locked"
                          checked={formData.locked}
                          onCheckedChange={(checked) => handleInputChange('locked', checked)}
                          disabled={editingSection !== 'podcast'}
                        />
                        <Label htmlFor="locked">Locked (Paid)</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id="complete"
                          checked={formData.complete}
                          onCheckedChange={(checked) => handleInputChange('complete', checked)}
                          disabled={editingSection !== 'podcast'}
                        />
                        <Label htmlFor="complete">Complete</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id="useOP3"
                          checked={formData.useOP3}
                          onCheckedChange={(checked) => handleInputChange('useOP3', checked)}
                          disabled={editingSection !== 'podcast'}
                        />
                        <Label htmlFor="useOP3" className="flex items-center space-x-1">
                          <span>Use OP3 Analytics</span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs bg-popover text-popover-foreground border border-border shadow-md">
                                <p className="font-semibold mb-1">What is OP3?</p>
                                <p className="text-sm">
                                  OP3.dev (Open Podcast Prefix Project) provides podcast analytics by prefixing episode URLs.
                                  When enabled, all episode URLs will be automatically prefixed with https://op3.dev/e/ to track downloads and plays.
                                </p>
                                <a href="https://op3.dev" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-2 block">
                                  Learn more at OP3.dev →
                                </a>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </Label>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="guid">GUID (Podcast Identifier)</Label>
                        <Input
                          id="guid"
                          value={formData.guid}
                          onChange={(e) => handleInputChange('guid', e.target.value)}
                          disabled={editingSection !== 'podcast'}
                          placeholder="Unique podcast identifier"
                        />
                      </div>

                      <div>
                        <Label htmlFor="publisher">Publisher</Label>
                        <Input
                          id="publisher"
                          value={formData.publisher}
                          onChange={(e) => handleInputChange('publisher', e.target.value)}
                          disabled={editingSection !== 'podcast'}
                          placeholder="Publisher name"
                        />
                      </div>

                      <div>
                        <Label htmlFor="value-amount">Suggested Value</Label>
                        <div className="flex space-x-2">
                          <Input
                            id="value-amount"
                            type="number"
                            value={formData.value.amount}
                            onChange={(e) => handleInputChange('value', {
                              ...formData.value,
                              amount: parseFloat(e.target.value) || 0
                            })}
                            disabled={editingSection !== 'podcast'}
                            placeholder="0"
                            className="flex-1"
                          />
                          <select
                            value={formData.value.currency}
                            onChange={(e) => handleInputChange('value', {
                              ...formData.value,
                              currency: e.target.value
                            })}
                            disabled={editingSection !== 'podcast'}
                            className="p-2 border border-input bg-background text-foreground rounded-md focus:ring-2 focus:ring-ring focus:border-ring disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                            <option value="BTC">BTC</option>
                            <option value="SATS">SATS</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="license-identifier">License</Label>
                        <Input
                          id="license-identifier"
                          value={formData.license.identifier}
                          onChange={(e) => handleInputChange('license', {
                            ...formData.license,
                            identifier: e.target.value
                          })}
                          disabled={editingSection !== 'podcast'}
                          placeholder="e.g., CC BY 4.0"
                        />
                      </div>

                      <div>
                        <Label htmlFor="license-url">License URL</Label>
                        <Input
                          id="license-url"
                          value={formData.license.url || ''}
                          onChange={(e) => handleInputChange('license', {
                            ...formData.license,
                            url: e.target.value
                          })}
                          disabled={editingSection !== 'podcast'}
                          placeholder="https://creativecommons.org/licenses/..."
                        />
                      </div>

                      <div>
                        <Label htmlFor="location-name">Location</Label>
                        <Input
                          id="location-name"
                          value={formData.location?.name || ''}
                          onChange={(e) => handleInputChange('location', {
                            ...formData.location,
                            name: e.target.value
                          })}
                          disabled={editingSection !== 'podcast'}
                          placeholder="Recording location"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Categories */}
                  <div>
                    <Label>Categories</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.categories.map((category) => (
                        <Badge key={category} variant="secondary" className="flex items-center space-x-1">
                          <span>{category}</span>
                          {editingSection === 'podcast' && (
                            <button
                              onClick={() => handleCategoryRemove(category)}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </Badge>
                      ))}
                    </div>

                    {editingSection === 'podcast' && (
                      <div className="flex space-x-2 mt-2">
                        <Input
                          placeholder="Add category"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleCategoryAdd((e.target as HTMLInputElement).value);
                              (e.target as HTMLInputElement).value = '';
                            }
                          }}
                        />
                        <Button
                          type="button"
                          onClick={() => {
                            const input = document.querySelector('input[placeholder="Add category"]') as HTMLInputElement;
                            if (input?.value) {
                              handleCategoryAdd(input.value);
                              input.value = '';
                            }
                          }}
                        >
                          Add
                        </Button>
                      </div>
                    )}

                    <p className="text-sm text-muted-foreground mt-2">
                      Add categories that best describe your podcast content. This helps with discovery in podcast directories.
                    </p>
                  </div>

                  {/* Funding Links */}
                  <div>
                    <Label>Funding Links</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.funding.map((funding, index) => (
                        <Badge key={index} variant="outline" className="flex items-center space-x-1">
                          <DollarSign className="w-3 h-3" />
                          <span className="truncate max-w-xs">{funding}</span>
                          {editingSection === 'podcast' && (
                            <button
                              onClick={() => handleFundingRemove(funding)}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </Badge>
                      ))}
                    </div>

                    {editingSection === 'podcast' && (
                      <div className="flex space-x-2 mt-2">
                        <Input
                          placeholder="Add funding link (e.g., /about or https://patreon.com/yourpodcast)"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleFundingAdd((e.target as HTMLInputElement).value);
                              (e.target as HTMLInputElement).value = '';
                            }
                          }}
                        />
                        <Button
                          type="button"
                          onClick={() => {
                            const input = document.querySelector('input[placeholder^="Add funding link"]') as HTMLInputElement;
                            if (input?.value) {
                              handleFundingAdd(input.value);
                              input.value = '';
                            }
                          }}
                        >
                          Add
                        </Button>
                      </div>
                    )}

                    <p className="text-sm text-muted-foreground mt-2">
                      Add funding links for listeners to support your podcast. Use "/about" to link to your built-in zap page, or add external URLs to platforms like Patreon, Ko-fi, PayPal, etc.
                    </p>
                  </div>

                  {/* Value Recipients */}
                  <div>
                    <Label>Value Recipients (Podcasting 2.0)</Label>
                    <p className="text-sm text-muted-foreground mb-4">
                      Configure Lightning payment recipients for value-for-value support. Recipients will receive payments automatically when listeners send value.
                    </p>

                    {/* Existing Recipients */}
                    <div className="space-y-3 mb-4">
                      {(formData.value.recipients || []).map((recipient, index) => (
                        <div key={index} className="p-4 border rounded-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">Recipient {index + 1}</h4>
                            {editingSection === 'podcast' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRecipientRemove(index)}
                                className="text-destructive hover:text-destructive"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <Label>Name</Label>
                              <Input
                                value={recipient.name}
                                onChange={(e) => handleRecipientUpdate(index, 'name', e.target.value)}
                                disabled={editingSection !== 'podcast'}
                                placeholder="Recipient name"
                              />
                            </div>

                            <div>
                              <Label>Type</Label>
                              <select
                                value={recipient.type}
                                onChange={(e) => handleRecipientUpdate(index, 'type', e.target.value)}
                                disabled={editingSection !== 'podcast'}
                                className="w-full p-2 border border-input bg-background text-foreground rounded-md focus:ring-2 focus:ring-ring focus:border-ring disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <option value="node">Lightning Node</option>
                                <option value="lnaddress">Lightning Address</option>
                              </select>
                            </div>

                            <div>
                              <Label>Address</Label>
                              <Input
                                value={recipient.address}
                                onChange={(e) => handleRecipientUpdate(index, 'address', e.target.value)}
                                disabled={editingSection !== 'podcast'}
                                placeholder="Lightning node pubkey or lightning address"
                              />
                            </div>

                            <div>
                              <Label>Split (%)</Label>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                value={recipient.split}
                                onChange={(e) => handleRecipientUpdate(index, 'split', parseInt(e.target.value) || 0)}
                                disabled={editingSection !== 'podcast'}
                                placeholder="0-100"
                              />
                            </div>

                            <div>
                              <Label>Custom Key (Optional)</Label>
                              <Input
                                value={recipient.customKey || ''}
                                onChange={(e) => handleRecipientUpdate(index, 'customKey', e.target.value)}
                                disabled={editingSection !== 'podcast'}
                                placeholder="Custom TLV key for Lightning payments"
                              />
                            </div>

                            <div>
                              <Label>Custom Value (Optional)</Label>
                              <Input
                                value={recipient.customValue || ''}
                                onChange={(e) => handleRecipientUpdate(index, 'customValue', e.target.value)}
                                disabled={editingSection !== 'podcast'}
                                placeholder="Custom TLV value for Lightning payments"
                              />
                            </div>

                            <div className="flex items-center space-x-2">
                              <Switch
                                checked={recipient.fee || false}
                                onCheckedChange={(checked) => handleRecipientUpdate(index, 'fee', checked)}
                                disabled={editingSection !== 'podcast'}
                              />
                              <Label>Fee Recipient</Label>
                            </div>
                          </div>
                        </div>
                      ))}

                      {(formData.value.recipients || []).length === 0 && (
                        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                          No value recipients configured. Add recipients to enable Lightning payments.
                        </div>
                      )}
                    </div>

                    {/* Add New Recipient */}
                    {editingSection === 'podcast' && (
                      <div className="p-4 border-2 border-dashed rounded-lg">
                        <h4 className="font-medium mb-3">Add New Recipient</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                          <Input
                            id="new-recipient-name"
                            placeholder="Recipient name"
                          />
                          <select
                            id="new-recipient-type"
                            className="w-full p-2 border border-input bg-background text-foreground rounded-md focus:ring-2 focus:ring-ring focus:border-ring disabled:cursor-not-allowed disabled:opacity-50"
                            defaultValue="node"
                          >
                            <option value="node">Lightning Node</option>
                            <option value="lnaddress">Lightning Address</option>
                          </select>
                          <Input
                            id="new-recipient-address"
                            placeholder="Lightning node pubkey or lightning address"
                            className="md:col-span-2"
                          />
                          <Input
                            id="new-recipient-split"
                            type="number"
                            min="0"
                            max="100"
                            placeholder="Split percentage (0-100)"
                          />
                        </div>
                        <Button
                          type="button"
                          onClick={() => {
                            const nameInput = document.getElementById('new-recipient-name') as HTMLInputElement;
                            const typeSelect = document.getElementById('new-recipient-type') as HTMLSelectElement;
                            const addressInput = document.getElementById('new-recipient-address') as HTMLInputElement;
                            const splitInput = document.getElementById('new-recipient-split') as HTMLInputElement;

                            if (nameInput?.value && addressInput?.value && splitInput?.value) {
                              handleRecipientAdd({
                                name: nameInput.value,
                                type: typeSelect.value as 'node' | 'lnaddress',
                                address: addressInput.value,
                                split: parseInt(splitInput.value) || 0
                              });

                              nameInput.value = '';
                              addressInput.value = '';
                              splitInput.value = '';
                            }
                          }}
                        >
                          Add Recipient
                        </Button>
                      </div>
                    )}

                    <div className="mt-4">
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p><strong>Total Split:</strong> {(formData.value.recipients || []).reduce((sum, r) => sum + r.split, 0)}%</p>
                        <p className="text-xs">Note: Total split percentage should equal 100% for proper value distribution.</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Episodes Tab */}
            <TabsContent value="episodes" className="space-y-6">
              <EpisodeManagement />
            </TabsContent>

            {/* Trailers Tab */}
            <TabsContent value="trailers" className="space-y-6">
              <TrailerManagement />
            </TabsContent>

            {/* Blossom Media Servers Tab */}
            <TabsContent value="blossom" className="space-y-6">
              <BlossomServerManager />
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-6">
              {/* Nostr Engagement Analytics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Zap className="w-5 h-5" />
                    <span>Nostr Engagement</span>
                  </CardTitle>
                  <CardDescription>Social interactions from the Nostr network</CardDescription>
                </CardHeader>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardContent className="p-6 text-center">
                    <Mic className="w-12 h-12 mx-auto mb-4 text-primary" />
                    <div className="text-2xl font-bold">
                      {analyticsLoading ? '...' : analytics?.totalEpisodes || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Episodes</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6 text-center">
                    <Zap className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
                    <div className="text-2xl font-bold">
                      {analyticsLoading ? '...' : analytics?.totalZaps || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Zaps</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6 text-center">
                    <MessageSquare className="w-12 h-12 mx-auto mb-4 text-blue-500" />
                    <div className="text-2xl font-bold">
                      {analyticsLoading ? '...' : analytics?.totalComments || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Comments</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6 text-center">
                    <Repeat2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
                    <div className="text-2xl font-bold">
                      {analyticsLoading ? '...' : analytics?.totalReposts || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Reposts</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Episodes */}
                <Card>
                  <CardHeader>
                    <CardTitle>Top Episodes by Engagement</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analyticsLoading ? (
                      <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="animate-pulse">
                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                          </div>
                        ))}
                      </div>
                    ) : analytics?.topEpisodes && analytics.topEpisodes.length > 0 ? (
                      <div className="space-y-4">
                        {analytics.topEpisodes.slice(0, 5).map((episode, index) => (
                          <div key={episode.episode.id} className="flex items-center space-x-3 p-3 rounded-lg bg-muted">
                            <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium truncate">
                                {episode.episode.title}
                              </h4>
                              <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                                <span className="flex items-center">
                                  <Zap className="w-3 h-3 mr-1 text-yellow-500" />
                                  {episode.zaps}
                                </span>
                                <span className="flex items-center">
                                  <MessageSquare className="w-3 h-3 mr-1 text-blue-500" />
                                  {episode.comments}
                                </span>
                                <span className="flex items-center">
                                  <Repeat2 className="w-3 h-3 mr-1 text-green-500" />
                                  {episode.reposts}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Mic className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No episode engagement data yet.</p>
                        <p className="text-sm">Publish episodes and engagement will appear here!</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Activity */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analyticsLoading ? (
                      <div className="space-y-3">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="animate-pulse flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                            <div className="flex-1">
                              <div className="h-3 bg-gray-200 rounded w-2/3 mb-1"></div>
                              <div className="h-2 bg-gray-200 rounded w-1/2"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : analytics?.recentActivity && analytics.recentActivity.length > 0 ? (
                      <div className="space-y-4">
                        {analytics.recentActivity.slice(0, 8).map((activity, index) => (
                          <div key={index} className="flex items-center space-x-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              activity.type === 'zap' ? 'bg-yellow-100 text-yellow-700' :
                              activity.type === 'comment' ? 'bg-blue-100 text-blue-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {activity.type === 'zap' ? (
                                <Zap className="w-4 h-4" />
                              ) : activity.type === 'comment' ? (
                                <MessageSquare className="w-4 h-4" />
                              ) : (
                                <Repeat2 className="w-4 h-4" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm">
                                <span className="font-medium">
                                  {activity.type === 'zap' ? 'Zapped' :
                                   activity.type === 'comment' ? 'Commented on' :
                                   'Reposted'}
                                </span>{' '}
                                <span className="text-muted-foreground truncate">
                                  {activity.episodeTitle}
                                </span>
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {activity.timestamp.toLocaleDateString()} at {activity.timestamp.toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No recent activity yet.</p>
                        <p className="text-sm">Listener interactions will appear here!</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Trailers Analytics */}
              {analytics && analytics.totalTrailers > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Play className="w-5 h-5" />
                      <span>Trailer Performance</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-blue-900">
                            {analytics.totalTrailers} trailer{analytics.totalTrailers !== 1 ? 's' : ''} published
                          </p>
                          <p className="text-xs text-blue-700 mt-1">
                            Trailers help new listeners discover your podcast content
                          </p>
                        </div>
                        <div className="text-2xl font-bold text-blue-600">
                          {analytics.totalTrailers}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* OP3.dev Analytics Section */}
              <OP3Analytics />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
};

export default Studio;