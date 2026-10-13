import { SignUp } from '@clerk/nextjs';
import { AuthShell } from '@/components/dashboard/auth-shell';
import { allowedDomains } from '@/lib/auth';

export default function SignUpPage() {
  return (
    <AuthShell>
      <SignUp routing="path" path="/sign-up" fallbackRedirectUrl="/dashboard" />
      <p className="text-center text-sm text-muted-foreground">Access is limited to {allowedDomains().join(', ')} Google accounts.</p>
    </AuthShell>
  );
}
