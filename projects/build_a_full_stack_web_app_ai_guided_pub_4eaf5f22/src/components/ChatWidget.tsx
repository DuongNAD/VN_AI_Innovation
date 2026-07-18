'use client';

import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { useEffect, useState } from 'react';

/** Paths where the floating chat launcher must not appear. */
const HIDE_ON_PATHS = [
  '/user/chat',
  '/user/form',
  '/user/checklist',
  '/user/result',
  '/user/login',
  '/user/register',
  '/chat',
  '/form',
  '/checklist',
  '/result',
  '/admin',
  '/manager',
] as const;

function pathIsHidden(pathname: string): boolean {
  return HIDE_ON_PATHS.some((path) => pathname === path || pathname.startsWith(path + '/'));
}

export default function ChatWidget() {
  const pathname = usePathname();
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    // Nested iframe (e.g. widget panel loading /user/chat?embed=1): never inject another launcher
    if (typeof window !== 'undefined' && window.self !== window.top) {
      setShouldShow(false);
      return;
    }

    setShouldShow(!pathIsHidden(pathname));
  }, [pathname]);

  if (!shouldShow) {
    return null;
  }

  return (
    <Script
      src="/widget.js"
      strategy="afterInteractive"
      data-widget-id="homepage-widget"
      data-theme="light"
      data-position="bottom-right"
    />
  );
}
