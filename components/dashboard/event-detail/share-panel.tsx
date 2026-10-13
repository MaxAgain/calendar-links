'use client';

import { CheckIcon, CopyIcon, ExternalLinkIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { copyToClipboard } from '@/components/dashboard/copy-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';

const STEPS = [
  <>In Klaviyo, add a <strong className="font-medium text-foreground">Button</strong> block (e.g. “Zum Kalender hinzufügen”).</>,
  <>Paste the link as the button’s link address.</>,
  <>Send a test email to yourself and click the button on your phone.</>,
];

/** Link for Klaviyo with an optional utm_content tag, plus the steps to use it in an email. */
export function SharePanel({ eventId, baseLink }: { eventId: string; baseLink: string }) {
  const [tag, setTag] = useState('');
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const link = tag.trim() ? `${baseLink}?utm_content=${encodeURIComponent(tag.trim())}` : baseLink;

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    if (!(await copyToClipboard(link))) return;
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Link for Klaviyo</CardTitle>
          <CardDescription>Use this address as the link of your calendar button.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="share-link" className="sr-only">Link for Klaviyo</FieldLabel>
              <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                <InputGroup className="min-w-0 flex-1 basis-full sm:basis-0">
                  <InputGroupInput
                    id="share-link"
                    readOnly
                    value={link}
                    spellCheck={false}
                    className="font-mono"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton onClick={copy}>
                      {copied ? <CheckIcon /> : <CopyIcon />}
                      Copy
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                <Button variant="outline" asChild>
                  <a href={`/e/${eventId}`} target="_blank" rel="noopener">
                    <ExternalLinkIcon />
                    Open page
                  </a>
                </Button>
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="share-utm-content">Tag this link (optional)</FieldLabel>
              <Input
                id="share-utm-content"
                type="text"
                maxLength={60}
                placeholder="e.g. reminder-email"
                spellCheck={false}
                autoComplete="off"
                aria-describedby="share-utm-content-hint"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
              />
              <FieldDescription id="share-utm-content-hint">
                Shows up in the stats and the Google Sheet. Klaviyo adds utm_source and utm_campaign automatically if UTM tracking is enabled.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add it to your email</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <ol className="flex flex-col gap-3">
            {STEPS.map((step, index) => (
              <li key={index} className="flex items-start gap-3 text-sm text-muted-foreground">
                <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
                  {index + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
          <p className="text-sm text-muted-foreground">
            Klaviyo’s UTM parameters are fine, but never put profile merge tags (email, name, profile ID) into UTM values. UTM values containing @ are discarded.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
