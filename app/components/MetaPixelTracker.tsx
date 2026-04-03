'use client';

import { useEffect } from 'react';
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

  useEffect(() => {
    const signup = searchParams.get('signup');

    if (
      pathname === '/landlord' &&
      signup === '1' &&
      typeof window !== 'undefined' &&
      typeof window.fbq === 'function'
    ) {
      window.fbq('track', 'CompleteRegistration');
      router.replace('/landlord');
    }
  }, [pathname, router, searchParams]);

  return null;
}