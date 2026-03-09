import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState } from "react";
import { useAppContext } from "@/hooks/useAppContext";

interface RelaySelectorProps {
  className?: string;
}

export function RelaySelector(props: RelaySelectorProps) {
  const { className } = props;
  const { config, updateConfig, presetRelays = [] } = useAppContext();

  const selectedRelay = config.relayUrl;
  const setSelectedRelay = (relay: string) => {
    updateConfig((current) => ({ ...current, relayUrl: relay }));
  };

  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const selectedOption = presetRelays.find((option) => option.url === selectedRelay);

  // Function to normalize relay URL by adding wss:// if no protocol is present
  const normalizeRelayUrl = (url: string): string => {
    const trimmed = url.trim();
    // Upgrade ws:// to wss:// for security - unencrypted connections expose all Nostr traffic
    if (trimmed.startsWith("ws://")) {
      return `wss://${trimmed.slice(5)}`;
    }
    if (trimmed.startsWith("wss://")) {
      return trimmed;
    }
    return `wss://${trimmed}`;
  };

  // Function to validate relay URL format
  const isValidRelayInput = (input: string): boolean => {
    const trimmed = input.trim();
    if (!trimmed) return false;

    // Only allow wss:// (encrypted) relay connections
    const normalized = normalizeRelayUrl(trimmed);
    try {
      new URL(normalized);
      return normalized.startsWith("wss://");
    } catch {
      return false;
    }
  };

  const handleAddCustomRelay = (url: string) => {
    const normalized = normalizeRelayUrl(url);
    setSelectedRelay(normalized);
    setOpen(false);
    setInputValue("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          {selectedOption ? (
            <div className="flex flex-col items-start">
              <span className="font-medium">{selectedOption.name}</span>
              <span className="text-xs text-muted-foreground">{selectedOption.url}</span>
            </div>
          ) : (
            <div className="flex flex-col items-start">
              <span className="font-medium">Select relay</span>
              <span className="text-xs text-muted-foreground">{selectedRelay}</span>
            </div>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput
            placeholder="Search relays or type URL..."
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty>
              {inputValue && isValidRelayInput(inputValue) ? (
                <CommandItem
                  onSelect={() => handleAddCustomRelay(inputValue)}
                  className="cursor-pointer"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span className="font-medium">Add custom relay</span>
                    <span className="text-xs text-muted-foreground">
                      {normalizeRelayUrl(inputValue)}
                    </span>
                  </div>
                </CommandItem>
              ) : (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No relays found.
                </div>
              )}
            </CommandEmpty>
            <CommandGroup>
              {presetRelays.map((option) => (
                <CommandItem
                  key={option.url}
                  onSelect={() => {
                    setSelectedRelay(option.url);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedRelay === option.url ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{option.name}</span>
                    <span className="text-xs text-muted-foreground">{option.url}</span>
                  </div>
                </CommandItem>
              ))}
              {inputValue && isValidRelayInput(inputValue) && (
                <CommandItem
                  onSelect={() => handleAddCustomRelay(inputValue)}
                  className="cursor-pointer border-t"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span className="font-medium">Add custom relay</span>
                    <span className="text-xs text-muted-foreground">
                      {normalizeRelayUrl(inputValue)}
                    </span>
                  </div>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}