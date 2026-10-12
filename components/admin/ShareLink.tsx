'use client';

import { useState } from 'react';
import { CopyButton } from './CopyButton';

/** Link for Klaviyo, with an optional utm_content tag (e.g. for A/B tests). */
export function ShareLink({ baseLink }: { baseLink: string }) {
  const [tag, setTag] = useState('');
  const link = tag.trim() ? `${baseLink}?utm_content=${encodeURIComponent(tag.trim())}` : baseLink;
  return (
    <>
      <label className="field-label" htmlFor="share-link">Link for Klaviyo</label>
      <div className="mb-3 flex gap-2">
        <input id="share-link" className="input flex-1 font-mono" type="text" readOnly value={link} onFocus={(e) => e.target.select()} />
        <CopyButton text={link} className="btn btn-primary" />
      </div>
      <details className="mb-4">
        <summary className="mb-2 cursor-pointer text-sk-blue-600">Optional: tag this link (e.g. for an A/B test or a specific email)</summary>
        <label className="field-label" htmlFor="utm-content">utm_content</label>
        <input id="utm-content" className="input" type="text" maxLength={60} placeholder="e.g. reminder-email" spellCheck={false} value={tag} onChange={(e) => setTag(e.target.value)} />
        <p className="hint">Shows up in the stats and the Google Sheet. Klaviyo adds utm_source / utm_campaign automatically if UTM tracking is enabled in Klaviyo.</p>
      </details>
    </>
  );
}
