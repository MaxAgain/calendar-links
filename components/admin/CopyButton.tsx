'use client';

import { useState } from 'react';

export function CopyButton({ text, label = 'Copy link', className = 'btn btn-primary btn-sm' }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt('Copy this link:', text);
        }
      }}
    >
      {copied ? 'Copied ✓' : label}
    </button>
  );
}
