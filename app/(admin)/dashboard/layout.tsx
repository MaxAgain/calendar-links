import { cookies } from 'next/headers';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { NavigationGuardProvider } from '@/components/dashboard/navigation-guard';
import { SiteHeader } from '@/components/dashboard/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { requireStaffPage } from '@/lib/auth';

export default async function DashboardLayout({ children }: LayoutProps<'/dashboard'>) {
  const user = await requireStaffPage();
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get('sidebar_state')?.value !== 'false';

  return (
    <NavigationGuardProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar user={{ name: user.name, email: user.email, imageUrl: user.imageUrl }} />
        <SidebarInset>
          <SiteHeader />
          <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </NavigationGuardProvider>
  );
}
