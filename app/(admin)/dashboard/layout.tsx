import { UserButton } from '@clerk/nextjs';
import { BrandBar } from '@/components/admin/BrandBar';
import { NavLinks } from '@/components/admin/NavLinks';
import { requireStaffPage } from '@/lib/auth';

export default async function DashboardLayout({ children }: LayoutProps<'/dashboard'>) {
  await requireStaffPage();
  return (
    <>
      <BrandBar>
        <div className="flex items-center gap-4">
          <NavLinks />
          <UserButton />
        </div>
      </BrandBar>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-12 pt-6">{children}</main>
    </>
  );
}
