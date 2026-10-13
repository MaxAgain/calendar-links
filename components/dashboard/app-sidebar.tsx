'use client';

import { CalendarDaysIcon, LayoutDashboardIcon, SheetIcon, type LucideIcon } from 'lucide-react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { GuardedLink } from '@/components/dashboard/navigation-guard';
import { NavUser, type NavUserData } from '@/components/dashboard/nav-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Overview is active only on exactly /dashboard; the others on their whole subtree. */
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { title: 'Overview', href: '/dashboard', icon: LayoutDashboardIcon, exact: true },
  { title: 'Events', href: '/dashboard/events', icon: CalendarDaysIcon },
  { title: 'Integrations', href: '/dashboard/integrations', icon: SheetIcon },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AppSidebar({ user }: { user: NavUserData }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Calendar Links" className="hover:bg-transparent active:bg-transparent">
              <GuardedLink href="/dashboard" onClick={() => setOpenMobile(false)} aria-label="Solakon Calendar Links, overview">
                <span className="hidden size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground group-data-[collapsible=icon]:flex">
                  <CalendarDaysIcon className="size-4" />
                </span>
                <span className="flex min-w-0 flex-col gap-1 group-data-[collapsible=icon]:hidden">
                  <Image src="/solakon-logo-white.png" alt="Solakon" width={434} height={96} unoptimized className="h-5 w-auto" />
                  <span className="truncate text-xs text-sidebar-foreground/70">Calendar Links</span>
                </span>
              </GuardedLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const active = isActive(pathname, item);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className="data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:hover:bg-sidebar-primary/90 data-[active=true]:hover:text-sidebar-primary-foreground"
                    >
                      <GuardedLink href={item.href} onClick={() => setOpenMobile(false)} aria-current={active ? 'page' : undefined}>
                        <item.icon />
                        <span>{item.title}</span>
                      </GuardedLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
