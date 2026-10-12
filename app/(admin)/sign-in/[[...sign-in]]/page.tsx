import { SignIn } from '@clerk/nextjs';
import { BrandBar } from '@/components/admin/BrandBar';

export default function SignInPage() {
  return (
    <>
      <BrandBar />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
        <SignIn routing="path" path="/sign-in" fallbackRedirectUrl="/dashboard" />
        <p className="text-sm text-sk-gray-600">Access is limited to solakon.de Google accounts.</p>
      </div>
    </>
  );
}
