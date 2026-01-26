import { useState } from 'react';
import { X, Plus, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { ValueRecipient, EpisodeValue } from '@/types/podcast';

interface ValueRecipientsEditorProps {
  value: EpisodeValue;
  onChange: (value: EpisodeValue) => void;
  podcastDefaults?: {
    amount?: number;
    currency?: string;
    recipients?: ValueRecipient[];
  };
  disabled?: boolean;
  className?: string;
}

export function ValueRecipientsEditor({
  value,
  onChange,
  podcastDefaults,
  disabled = false,
  className,
}: ValueRecipientsEditorProps) {
  const [newRecipient, setNewRecipient] = useState<Partial<ValueRecipient>>({
    name: '',
    type: 'lnaddress',
    address: '',
    split: 0,
  });

  const handleToggleEnabled = (enabled: boolean) => {
    onChange({
      ...value,
      enabled,
      // When enabling, initialize with empty recipients if none exist
      recipients: value.recipients.length > 0 ? value.recipients : [],
    });
  };

  const handleAddRecipient = () => {
    if (!newRecipient.name || !newRecipient.address || !newRecipient.split) {
      return;
    }

    const recipient: ValueRecipient = {
      name: newRecipient.name,
      type: newRecipient.type || 'lnaddress',
      address: newRecipient.address,
      split: newRecipient.split,
      customKey: newRecipient.customKey,
      customValue: newRecipient.customValue,
      fee: newRecipient.fee,
    };

    onChange({
      ...value,
      recipients: [...value.recipients, recipient],
    });

    // Reset the form
    setNewRecipient({
      name: '',
      type: 'lnaddress',
      address: '',
      split: 0,
    });
  };

  const handleRemoveRecipient = (index: number) => {
    onChange({
      ...value,
      recipients: value.recipients.filter((_, i) => i !== index),
    });
  };

  const handleUpdateRecipient = (index: number, field: keyof ValueRecipient, fieldValue: string | number | boolean) => {
    const updatedRecipients = [...value.recipients];
    updatedRecipients[index] = {
      ...updatedRecipients[index],
      [field]: fieldValue,
    };
    onChange({
      ...value,
      recipients: updatedRecipients,
    });
  };

  const totalSplit = value.recipients.reduce((sum, r) => sum + r.split, 0);
  const isValidSplit = totalSplit === 100 || value.recipients.length === 0;

  return (
    <div className={className}>
      {/* Enable Override Toggle */}
      <div className="flex items-center justify-between rounded-lg border p-4 mb-4">
        <div className="space-y-0.5">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            <Label className="text-base font-medium">Custom Value Splits</Label>
          </div>
          <p className="text-sm text-muted-foreground">
            Override podcast-level value splits for this episode
          </p>
        </div>
        <Switch
          checked={value.enabled}
          onCheckedChange={handleToggleEnabled}
          disabled={disabled}
        />
      </div>

      {value.enabled && (
        <>
          {/* Show podcast defaults info */}
          {podcastDefaults && podcastDefaults.recipients && podcastDefaults.recipients.length > 0 && (
            <div className="mb-4 p-3 bg-muted/50 rounded-lg text-sm">
              <p className="font-medium mb-1">Podcast defaults being overridden:</p>
              <ul className="text-muted-foreground space-y-1">
                {podcastDefaults.recipients.map((r, i) => (
                  <li key={i}>{r.name}: {r.split}%</li>
                ))}
              </ul>
            </div>
          )}

          {/* Amount and Currency */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <Label>Suggested Amount (per minute)</Label>
              <Input
                type="number"
                value={value.amount || ''}
                onChange={(e) => onChange({ ...value, amount: parseInt(e.target.value) || undefined })}
                disabled={disabled}
                placeholder="100"
              />
            </div>
            <div>
              <Label>Currency</Label>
              <select
                value={value.currency || 'sats'}
                onChange={(e) => onChange({ ...value, currency: e.target.value })}
                disabled={disabled}
                className="w-full h-10 px-3 border border-input bg-background text-foreground rounded-md focus:ring-2 focus:ring-ring focus:border-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="sats">Sats</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="BTC">BTC</option>
              </select>
            </div>
          </div>

          {/* Split Total Indicator */}
          <div className={`mb-4 p-2 rounded-lg text-sm ${isValidSplit ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300'}`}>
            Total split: {totalSplit}% {!isValidSplit && '(must equal 100%)'}
          </div>

          {/* Existing Recipients */}
          <div className="space-y-3 mb-4">
            {value.recipients.map((recipient, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Recipient {index + 1}</h4>
                  {!disabled && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveRecipient(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={recipient.name}
                      onChange={(e) => handleUpdateRecipient(index, 'name', e.target.value)}
                      disabled={disabled}
                      placeholder="Recipient name"
                    />
                  </div>

                  <div>
                    <Label>Type</Label>
                    <select
                      value={recipient.type}
                      onChange={(e) => handleUpdateRecipient(index, 'type', e.target.value)}
                      disabled={disabled}
                      className="w-full h-10 px-3 border border-input bg-background text-foreground rounded-md focus:ring-2 focus:ring-ring focus:border-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="lnaddress">Lightning Address</option>
                      <option value="node">Lightning Node</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <Label>Address</Label>
                    <Input
                      value={recipient.address}
                      onChange={(e) => handleUpdateRecipient(index, 'address', e.target.value)}
                      disabled={disabled}
                      placeholder={recipient.type === 'lnaddress' ? 'name@getalby.com' : 'Node pubkey'}
                    />
                  </div>

                  <div>
                    <Label>Split (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={recipient.split}
                      onChange={(e) => handleUpdateRecipient(index, 'split', parseInt(e.target.value) || 0)}
                      disabled={disabled}
                      placeholder="0-100"
                    />
                  </div>

                  <div className="flex items-center space-x-2 pt-6">
                    <Switch
                      checked={recipient.fee || false}
                      onCheckedChange={(checked) => handleUpdateRecipient(index, 'fee', checked)}
                      disabled={disabled}
                    />
                    <Label>Fee Recipient</Label>
                  </div>
                </div>
              </div>
            ))}

            {value.recipients.length === 0 && (
              <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                No recipients configured. Add recipients below.
              </div>
            )}
          </div>

          {/* Add New Recipient */}
          {!disabled && (
            <div className="p-4 border-2 border-dashed rounded-lg">
              <h4 className="font-medium mb-3 flex items-center space-x-2">
                <Plus className="w-4 h-4" />
                <span>Add Recipient</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <Input
                  value={newRecipient.name || ''}
                  onChange={(e) => setNewRecipient({ ...newRecipient, name: e.target.value })}
                  placeholder="Recipient name (e.g., Guest Name)"
                />
                <select
                  value={newRecipient.type || 'lnaddress'}
                  onChange={(e) => setNewRecipient({ ...newRecipient, type: e.target.value as 'node' | 'lnaddress' })}
                  className="h-10 px-3 border border-input bg-background text-foreground rounded-md focus:ring-2 focus:ring-ring focus:border-ring"
                >
                  <option value="lnaddress">Lightning Address</option>
                  <option value="node">Lightning Node</option>
                </select>
                <Input
                  value={newRecipient.address || ''}
                  onChange={(e) => setNewRecipient({ ...newRecipient, address: e.target.value })}
                  placeholder={newRecipient.type === 'lnaddress' ? 'name@getalby.com' : 'Node pubkey'}
                  className="sm:col-span-2"
                />
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={newRecipient.split || ''}
                  onChange={(e) => setNewRecipient({ ...newRecipient, split: parseInt(e.target.value) || 0 })}
                  placeholder="Split percentage (0-100)"
                />
                <Button
                  type="button"
                  onClick={handleAddRecipient}
                  disabled={!newRecipient.name || !newRecipient.address || !newRecipient.split}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Recipient
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
