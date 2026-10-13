import { SignOutButton } from '@clerk/nextjs';
import { currentUser } from '@clerk/nextjs/server';
import { ShieldAlertIcon } from 'lucide-react';
import { AuthShell } from '@/components/dashboard/auth-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { allowedDomains } from '@/lib/auth';

export default async function NoAccessPage() {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  const domains = allowedDomains().map((d) => `@${d}`);
  const domainText = domains.length > 1 ? `${domains.slice(0, -1).join(', ')} or ${domains[domains.length - 1]}` : domains[0];

  return (
    <AuthShell>
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <ShieldAlertIcon className="size-5" aria-hidden />
          </div>
          <CardTitle className="text-lg">No access</CardTitle>
          <CardDescription>
            {email ? (
              <>
                You are signed in as <span className="font-medium text-foreground">{email}</span>.{' '}
              </>
            ) : null}
            The dashboard is only available for verified {domainText} accounts.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Sign out and sign in again with your Solakon Google account.</CardContent>
        <CardFooter>
          <SignOutButton redirectUrl="/sign-in">
            <Button>Sign out</Button>
          </SignOutButton>
        </CardFooter>
      </Card>
    </AuthShell>
  );
}
