'use client';

import { useClerk } from '@clerk/nextjs';
import { ChevronsUpDownIcon, LogOutIcon, UserCogIcon } from 'lucide-react';
import { ThemeMenuItems } from '@/components/dashboard/theme/theme-toggle';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';

export interface NavUserData {
  name: string;
  email: string;
  imageUrl: string;
}

function initials(name: string): string {
  const parts = name
    .split('@')[0]
    .split(/[\s._-]+/)
    .filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}

function UserSummary({ user, onSidebar = false }: { user: NavUserData; onSidebar?: boolean }) {
  return (
    <>
      <Avatar className="size-8 rounded-lg">
        <AvatarImage src={user.imageUrl} alt="" />
        <AvatarFallback className="rounded-lg">{initials(user.name)}</AvatarFallback>
      </Avatar>
      <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{user.name}</span>
        <span className={onSidebar ? 'truncate text-xs text-sidebar-foreground/70' : 'truncate text-xs text-muted-foreground'}>{user.email}</span>
      </div>
    </>
  );
}

export function NavUser({ user }: { user: NavUserData }) {
  const { isMobile } = useSidebar();
  const { openUserProfile, signOut } = useClerk();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" tooltip={user.name} className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground">
              <UserSummary user={user} onSidebar />
              <ChevronsUpDownIcon className="ml-auto size-4 text-sidebar-foreground/70" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-56 rounded-lg" side={isMobile ? 'bottom' : 'right'} align="end" sideOffset={4}>
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5">
                <UserSummary user={user} />
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => openUserProfile()}>
                <UserCogIcon />
                Manage account
              </DropdownMenuItem>
              <ThemeMenuItems />
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => signOut({ redirectUrl: '/sign-in' })}>
              <LogOutIcon />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
