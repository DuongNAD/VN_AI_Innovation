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

/** Remove DOM nodes injected by public/widget.js (not managed by React). */
function destroyInjectedWidget(): void {
  if (typeof document === 'undefined') return;

  document.querySelectorAll('.pspw-launcher').forEach((el) => el.remove());
  document.querySelectorAll('.pspw-panel').forEach((el) => el.remove());
  document.getElementById('pspw-styles')?.remove();

  if (typeof window !== 'undefined') {
    try {
      delete (window as unknown as { PSPWidget?: unknown }).PSPWidget;
    } catch {
      (window as unknown as { PSPWidget?: unknown }).PSPWidget = undefined;
    }
  }
}

export default function ChatWidget() {
  const pathname = usePathname();
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    // Nested iframe (e.g. widget panel loading /user/chat?embed=1): never inject another launcher
    if (typeof window !== 'undefined' && window.self !== window.top) {
      destroyInjectedWidget();
      setShouldShow(false);
      return;
    }

    if (pathIsHidden(pathname)) {
      // React unmounts <Script> but widget.js already appended launcher/panel to body
      destroyInjectedWidget();
      setShouldShow(false);
      return;
    }

    setShouldShow(true);
  }, [pathname]);

  // Cleanup on unmount (e.g. full layout change)
  useEffect(() => {
    return () => {
      destroyInjectedWidget();
    };
  }, []);

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
