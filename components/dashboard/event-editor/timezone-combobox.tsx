'use client';

import { ChevronsUpDownIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { COMMON_ZONES } from './form-state';

export function TimezoneCombobox({
  id,
  value,
  onChange,
  zones,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** All zones except the common ones. Empty until the browser list is available. */
  zones: string[];
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const known = COMMON_ZONES.includes(value) || zones.includes(value);

  const pick = (zone: string) => {
    onChange(zone);
    setOpen(false);
  };

  const item = (zone: string) => (
    <CommandItem key={zone} value={zone} data-checked={zone === value} onSelect={() => pick(zone)}>
      {zone}
    </CommandItem>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          className="w-full min-w-0 justify-between font-normal"
        >
          <span className="truncate">{value || 'Select a time zone'}</span>
          <ChevronsUpDownIcon className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-64 p-0">
        <Command>
          <CommandInput placeholder="Search time zones…" aria-label="Search time zones" />
          <CommandList>
            <CommandEmpty>No time zone found.</CommandEmpty>
            {!known && value && <CommandGroup heading="Current">{item(value)}</CommandGroup>}
            <CommandGroup heading="Common">{COMMON_ZONES.map(item)}</CommandGroup>
            {zones.length > 0 && <CommandGroup heading="All time zones">{zones.map(item)}</CommandGroup>}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
