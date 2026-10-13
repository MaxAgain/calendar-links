'use client';

import { CheckIcon, CopyIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/** Copies text and reports the result in a toast. Returns whether the clipboard accepted it. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Link copied');
    return true;
  } catch {
    // The clipboard can be blocked (insecure context, permissions): show the text so it can be copied by hand.
    toast.error('Could not copy automatically', { description: text, duration: 10000 });
    return false;
  }
}

export function CopyButton({
  text,
  label = 'Copy link',
  variant,
  size,
  className,
}: {
  text: string;
  label?: string;
  variant?: React.ComponentProps<typeof Button>['variant'];
  size?: React.ComponentProps<typeof Button>['size'];
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    if (!(await copyToClipboard(text))) return;
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  const iconOnly = size?.startsWith('icon') ?? false;

  return (
    <Button type="button" variant={variant} size={size} className={className} onClick={copy}>
      {copied ? <CheckIcon /> : <CopyIcon />}
      {iconOnly ? <span className="sr-only">{label}</span> : label}
    </Button>
  );
}
