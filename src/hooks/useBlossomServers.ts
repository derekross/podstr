import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';

/**
 * Hook to manage user's Blossom server preferences (kind 10063)
 */
export function useBlossomServers() {
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const { mutateAsync: createEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  // Query user's current Blossom servers
  const { data: userServers = [], isLoading } = useQuery({
    queryKey: ['user-blossom-servers', user?.pubkey],
    queryFn: async (c) => {
      if (!user?.pubkey) return [];
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(2000)]);
      
      try {
        // Query user's Blossom server list (kind 10063)
        const events = await nostr.query([{
          kinds: [10063],
          authors: [user.pubkey],
          limit: 1
        }], { signal });

        if (events.length > 0) {
          const serverList = events[0];
          return serverList.tags
            .filter(([tagName]) => tagName === 'server')
            .map(([, serverUrl]) => serverUrl)
            .filter(url => url && (url.startsWith('http://') || url.startsWith('https://')));
        }
      } catch (error) {
        console.warn('Failed to fetch user Blossom servers:', error);
      }
      
      return [];
    },
    enabled: !!user?.pubkey,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Mutation to update user's Blossom servers
  const updateServers = useMutation({
    mutationFn: async (servers: string[]) => {
      if (!user) {
        throw new Error('Must be logged in to update server preferences');
      }

      // Validate server URLs
      const validServers = servers.filter(url => {
        try {
          new URL(url);
          return url.startsWith('http://') || url.startsWith('https://');
        } catch {
          return false;
        }
      });

      if (validServers.length === 0) {
        throw new Error('At least one valid server URL is required');
      }

      // Create kind 10063 event
      const tags: Array<[string, string]> = validServers.map(server => ['server', server]);

      const event = await createEvent({
        kind: 10063,
        content: '', // Must be empty for kind 10063
        tags
      });

      return event;
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['user-blossom-servers', user?.pubkey] });
    }
  });

  // Get combined server list (user + defaults)
  const getAllServers = () => {
    const defaultServers = [
      'https://nostr.download',
      'https://blossom.band'
    ];

    return [
      ...userServers,
      ...defaultServers.filter(server => !userServers.includes(server))
    ];
  };

  return {
    userServers,
    allServers: getAllServers(),
    isLoading,
    updateServers: updateServers.mutateAsync,
    isUpdating: updateServers.isPending
  };
}

/**
 * Default recommended Blossom servers
 */
export const DEFAULT_BLOSSOM_SERVERS = [
  'https://nostr.download',
  'https://blossom.band'
];

/**
 * Validate if a URL is a valid Blossom server URL
 */
export function isValidBlossomServerUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}