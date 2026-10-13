'use client';

// Blocks in-app navigation while a form has unsaved changes (pattern from the Next.js Link docs, `onNavigate`).
// The editor calls `setBlocked(dirty)`; every dashboard link that can leave the page is a <GuardedLink>.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ComponentProps } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface NavigationGuard {
  blocked: boolean;
  setBlocked: (blocked: boolean) => void;
  /** Navigates to `href`, asking first when there are unsaved changes. */
  navigate: (href: string) => void;
}

const NavigationGuardContext = createContext<NavigationGuard>({
  blocked: false,
  setBlocked: () => {},
  navigate: () => {},
});

export function NavigationGuardProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [blocked, setBlocked] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!blocked) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [blocked]);

  const navigate = useCallback(
    (href: string) => {
      if (blocked) setPendingHref(href);
      else router.push(href);
    },
    [blocked, router],
  );

  const value = useMemo(() => ({ blocked, setBlocked, navigate }), [blocked, navigate]);

  return (
    <NavigationGuardContext.Provider value={value}>
      {children}
      <AlertDialog open={pendingHref !== null} onOpenChange={(open) => !open && setPendingHref(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
            <AlertDialogDescription>You have unsaved changes. They will be lost if you leave this page.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const href = pendingHref;
                setBlocked(false);
                setPendingHref(null);
                if (href) router.push(href);
              }}
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </NavigationGuardContext.Provider>
  );
}

export function useNavigationGuard(): NavigationGuard {
  return useContext(NavigationGuardContext);
}

/** Drop-in replacement for next/link inside the dashboard. Asks before leaving a page with unsaved changes. */
export function GuardedLink({ onNavigate, ...props }: ComponentProps<typeof Link>) {
  const { blocked, navigate } = useNavigationGuard();
  return (
    <Link
      {...props}
      onNavigate={(e) => {
        onNavigate?.(e);
        if (blocked) {
          e.preventDefault();
          navigate(typeof props.href === 'string' ? props.href : (props.href.pathname ?? '/dashboard'));
        }
      }}
    />
  );
}
