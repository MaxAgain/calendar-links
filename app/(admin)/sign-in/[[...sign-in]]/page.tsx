import { SignIn } from '@clerk/nextjs';
import { AuthShell } from '@/components/dashboard/auth-shell';
import { allowedDomains } from '@/lib/auth';

export default function SignInPage() {
  return (
    <AuthShell>
      <SignIn routing="path" path="/sign-in" fallbackRedirectUrl="/dashboard" />
      <p className="text-center text-sm text-muted-foreground">Access is limited to {allowedDomains().join(', ')} Google accounts.</p>
    </AuthShell>
  );
}
