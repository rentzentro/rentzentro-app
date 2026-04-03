'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

export default function MetaPixelTracker() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasTrackedRef = useRef(false);

  useEffect(() => {
    const signup = searchParams.get('signup');

    if (
      pathname === '/landlord' &&
      signup === '1' &&
      !hasTrackedRef.current &&
      typeof window !== 'undefined' &&
      typeof window.fbq === 'function'
    ) {
      hasTrackedRef.current = true;

      // Fire the real conversion event
      window.fbq('track', 'CompleteRegistration');

      // Give Meta a moment to send the event before cleaning the URL
      const timer = window.setTimeout(() => {
        router.replace('/landlord');
      }, 1200);

      return () => window.clearTimeout(timer);
    }
  }, [pathname, router, searchParams]);

  return null;
}