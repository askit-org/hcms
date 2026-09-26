'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, type AuthUser } from '@/lib/hooks/useAuth';
import { isPlatformAdminUser, ADMIN_HOME_ROUTE } from '@/lib/hooks/usePermissions';
import LoadingScreen from '@/components/LoadingScreen';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const homeFor = (user: AuthUser | null) => (isPlatformAdminUser(user) ? ADMIN_HOME_ROUTE : '/dashboard');
    if (useAuth.persist.hasHydrated()) {
      if (isAuthenticated) {
        router.replace(homeFor(useAuth.getState().user));
      } else {
        router.replace('/login');
      }
    } else {
      const unsub = useAuth.persist.onFinishHydration((state) => {
        if (state.isAuthenticated) {
          router.replace(homeFor(state.user));
        } else {
          router.replace('/login');
        }
      });
      return () => unsub();
    }
  }, [isAuthenticated, router]);

  return <LoadingScreen message="Restoring session..." />;
}
