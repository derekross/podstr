import { ZapDialog } from '@/components/ZapDialog';
import { useZaps } from '@/hooks/useZaps';
import { useWallet } from '@/hooks/useWallet';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthor } from '@/hooks/useAuthor';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';
import type { Event } from 'nostr-tools';

interface ZapButtonProps {
  target: Event;
  className?: string;
  showCount?: boolean;
  zapData?: { count: number; totalSats: number; isLoading?: boolean };
  onZapSuccess?: (amount: number) => void;
}

export function ZapButton({
  target,
  className = "",
  showCount = true,
  zapData: externalZapData,
  onZapSuccess
}: ZapButtonProps) {
  const { user } = useCurrentUser();
  const { data: author } = useAuthor(target?.pubkey || '');
  const { webln, activeNWC } = useWallet();

  // Only fetch data if external data is not provided and user is logged in
  const { totalSats: fetchedTotalSats, isLoading } = useZaps(
    externalZapData ? [] : target ?? [], // Only fetch if no external data provided
    webln,
    activeNWC
  );

  // Don't show zap button if no target or user is not logged in
  if (!target || !user) {
    return null;
  }

  // Don't show zap button if user is the author or author has no lightning address
  if (user.pubkey === target.pubkey || (!author?.metadata?.lud16 && !author?.metadata?.lud06)) {
    return null;
  }

  // Use external data if provided, otherwise use fetched data
  const totalSats = externalZapData?.totalSats ?? fetchedTotalSats;
  const showLoading = externalZapData?.isLoading || isLoading;

  // User can zap - show clickable zap dialog
  return (
    <ZapDialog target={target} onZapSuccess={onZapSuccess}>
      <Button
        variant="ghost"
        size="sm"
        className={`text-muted-foreground hover:text-yellow-500 ${className}`}
      >
        <Zap className="w-5 h-5 sm:w-4 sm:h-4 mr-1.5 sm:mr-1" />
        <span className="text-sm sm:text-xs">
          {showLoading ? (
            '...'
          ) : externalZapData ? (
            externalZapData.totalSats || 0
          ) : showCount && totalSats > 0 ? (
            `${totalSats.toLocaleString()}`
          ) : (
            '0'
          )}
        </span>
      </Button>
    </ZapDialog>
  );
}