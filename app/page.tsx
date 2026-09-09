'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import LoadingScreen from '@/components/LoadingScreen';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (useAuth.persist.hasHydrated()) {
      if (isAuthenticated) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    } else {
      const unsub = useAuth.persist.onFinishHydration((state) => {
        if (state.isAuthenticated) {
          router.replace('/dashboard');
        } else {
          router.replace('/login');
        }
      });
      return () => unsub();
    }
  }, [isAuthenticated, router]);

  return <LoadingScreen message="Restoring session..." />;
}
