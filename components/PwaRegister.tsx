'use client';

import { useEffect } from 'react';
import { toast } from '@/components/Toast';

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });

        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                toast('New version of HCMS is available! Refresh to update.', 'info');
              }
            };
          }
        };
      } catch (error) {
        console.error('[SW] Registration failed:', error);
      }
    };

    registerSW();

    const handleOnline = () => {
      toast('Internet connection restored. HCMS is online.', 'success');
    };

    const handleOffline = () => {
      toast('Operating in Offline Mode. Local data remains saved.', 'info');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return null;
}
