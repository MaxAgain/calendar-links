'use client';

import { format, isValid, parse } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const ISO_DAY = 'yyyy-MM-dd';

/** 'yyyy-MM-dd' to a local-midnight Date, or undefined. Never goes through UTC, so the day cannot shift. */
function toDate(value: string): Date | undefined {
  if (!value) return undefined;
  const date = parse(value, ISO_DAY, new Date());
  return isValid(date) ? date : undefined;
}

export function DatePicker({
  id,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  id: string;
  /** 'yyyy-MM-dd' */
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = toDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn('w-full min-w-0 justify-start font-normal', !selected && 'text-muted-foreground')}
        >
          <CalendarIcon />
          <span className="truncate">{selected ? format(selected, 'EEE, d MMM yyyy') : 'Pick a date'}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          weekStartsOn={1}
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            if (!date) return;
            onChange(format(date, ISO_DAY));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
