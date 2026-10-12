import { SignUp } from '@clerk/nextjs';
import { BrandBar } from '@/components/admin/BrandBar';

export default function SignUpPage() {
  return (
    <>
      <BrandBar />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
        <SignUp routing="path" path="/sign-up" fallbackRedirectUrl="/dashboard" />
        <p className="text-sm text-sk-gray-600">Access is limited to solakon.de Google accounts.</p>
      </div>
    </>
  );
}
