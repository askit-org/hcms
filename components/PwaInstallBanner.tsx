'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Download, X, Share2, PlusSquare, Tablet, CheckCircle } from 'lucide-react';
import { toast } from '@/components/Toast';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // 0. Check if user already installed app previously
    if (localStorage.getItem('hcms_pwa_installed') === 'true') {
      setIsInstalled(true);
      return;
    }

    // 1. Check if launched as a standalone PWA
    const inStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    setIsStandalone(inStandalone);

    if (inStandalone) {
      setIsInstalled(true);
      localStorage.setItem('hcms_pwa_installed', 'true');
      return;
    }

    // 2. Detect iOS / iPadOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    setIsIOS(isIOSDevice);

    // 3. Listen for Chrome / Android beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // 4. Listen for appinstalled event (Fires when user installs the app)
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsDismissed(true);
      setDeferredPrompt(null);
      toast('HCMS App installed successfully!', 'success');
      localStorage.setItem('hcms_pwa_installed', 'true');
    };

    // 5. Check if user already installed via navigator.getInstalledRelatedApps
    if ('getInstalledRelatedApps' in navigator) {
      (navigator as unknown as { getInstalledRelatedApps: () => Promise<unknown[]> })
        .getInstalledRelatedApps()
        .then((apps) => {
          if (apps && apps.length > 0) {
            setIsInstalled(true);
          }
        })
        .catch(() => {});
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
        setIsDismissed(true);
        localStorage.setItem('hcms_pwa_installed', 'true');
        toast('Installing HCMS App...', 'info');
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSInstructions(prev => !prev);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  // Do not show if already in standalone app, installed, or closed for current view
  if (isStandalone || isInstalled || isDismissed) {
    return null;
  }

  // Show banner if install prompt is ready OR if on iOS/iPadOS device
  if (!deferredPrompt && !isIOS) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 max-w-md z-[9999] animate-pwa-pop">
      <div className="relative rounded-2xl p-4 transition-all duration-300 backdrop-blur-2xl bg-[var(--surface-solid)] border border-teal-500/30 text-[var(--text-primary)] shadow-2xl flex flex-col gap-3 group">
        
        {/* SVG Running Border Light Beams (Two lines traveling around perimeter) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none rounded-2xl overflow-visible z-10">
          <defs>
            <linearGradient id="runningLightGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2dd4bf" stopOpacity="1" />
              <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#0d9488" stopOpacity="0.2" />
            </linearGradient>
            <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Running Border Line 1 */}
          <rect
            x="1"
            y="1"
            width="calc(100% - 2px)"
            height="calc(100% - 2px)"
            rx="15"
            fill="none"
            stroke="url(#runningLightGrad)"
            strokeWidth="2.5"
            pathLength="100"
            filter="url(#lineGlow)"
            className="animate-running-border-1"
          />

          {/* Running Border Line 2 (Opposite side) */}
          <rect
            x="1"
            y="1"
            width="calc(100% - 2px)"
            height="calc(100% - 2px)"
            rx="15"
            fill="none"
            stroke="url(#runningLightGrad)"
            strokeWidth="2.5"
            pathLength="100"
            filter="url(#lineGlow)"
            className="animate-running-border-2"
          />
        </svg>

        <div className="flex items-center justify-between gap-3 pt-1 relative z-20">
          <div className="flex items-center gap-3">
            {/* App Icon */}
            <div className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 shadow-md shadow-teal-500/20 border border-teal-500/30">
              <Image
                src="/icons/icon-192x192.png"
                alt="HCMS App Icon"
                fill
                sizes="48px"
                className="object-cover"
              />
            </div>
            <div>
              <h4 className="font-bold text-sm leading-snug flex items-center gap-1.5 text-[var(--text-primary)]">
                HCMS App
                <span className="text-[10px] uppercase font-extrabold tracking-wider px-1.5 py-0.5 rounded-full bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30">
                  Askit Studio
                </span>
              </h4>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Install for offline access on Mobile & iPad
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-lg hover:bg-[var(--hover-btn)] transition-colors"
            title="Close banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {showIOSInstructions && (
          <div className="bg-[var(--surface-2)] rounded-xl p-3 text-xs text-[var(--text-secondary)] border border-teal-500/30 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-200 relative z-20">
            <p className="font-semibold text-teal-600 dark:text-teal-400 flex items-center gap-1.5">
              <Tablet className="w-3.5 h-3.5" /> To install on iPad / iPhone:
            </p>
            <ol className="list-decimal list-inside space-y-1">
              <li className="inline-flex items-center gap-1">
                Tap the <Share2 className="w-3.5 h-3.5 text-teal-500 inline mx-0.5" /> Share button in Safari
              </li>
              <li className="inline-flex items-center gap-1">
                Select <PlusSquare className="w-3.5 h-3.5 text-teal-500 inline mx-0.5" /> <strong>Add to Home Screen</strong>
              </li>
            </ol>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1 relative z-20">
          {/* Install Button with Continuous Shiny Light Sweep */}
          <button
            onClick={handleInstallClick}
            className="relative overflow-hidden flex-1 bg-gradient-to-r from-teal-600 via-teal-500 to-teal-600 hover:from-teal-500 hover:to-teal-400 text-white font-semibold text-xs py-2.5 px-4 rounded-xl shadow-lg shadow-teal-500/30 flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
          >
            {/* Continuous Shiny Light Reflection Sweep */}
            <span className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shiny-light pointer-events-none" />

            <Download className="w-4 h-4 relative z-10" />
            <span className="relative z-10">{isIOS ? 'Show How to Install' : 'Install App'}</span>
          </button>

          <button
            onClick={handleDismiss}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-3 py-2.5 rounded-xl hover:bg-[var(--hover-btn)] transition-colors font-medium"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
