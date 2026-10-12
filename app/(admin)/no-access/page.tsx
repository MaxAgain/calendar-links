import { SignOutButton } from '@clerk/nextjs';
import { currentUser } from '@clerk/nextjs/server';
import { BrandBar } from '@/components/admin/BrandBar';
import { allowedDomains } from '@/lib/auth';

export default async function NoAccessPage() {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  const domains = allowedDomains().map((d) => `@${d}`).join(', ');
  return (
    <>
      <BrandBar />
      <div className="mx-auto w-full max-w-lg flex-1 px-4 py-12">
        <div className="panel">
          <h1 className="mb-3 text-xl font-bold">No access</h1>
          <p className="mb-2">
            {email ? <>You are signed in as <strong>{email}</strong>. </> : null}
            The dashboard is only available for verified {domains} accounts.
          </p>
          <p className="mb-5 text-sm text-sk-gray-600">Sign out and sign in again with your Solakon Google account.</p>
          <SignOutButton redirectUrl="/sign-in">
            <button type="button" className="btn btn-primary">Sign out</button>
          </SignOutButton>
        </div>
      </div>
    </>
  );
}
