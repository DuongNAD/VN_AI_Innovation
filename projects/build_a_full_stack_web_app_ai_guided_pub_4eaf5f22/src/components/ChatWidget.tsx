'use client';

import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { useEffect, useState } from 'react';

export default function ChatWidget() {
  const pathname = usePathname();
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    // Ẩn widget trên luồng hồ sơ chính để không che CTA
    const hideOnPaths = [
      '/user/chat',
      '/user/form',
      '/user/checklist',
      '/user/result',
      '/chat',
      '/form',
      '/checklist',
      '/result',
      '/admin',
      '/manager',
    ];
    const hide = hideOnPaths.some((path) => pathname === path || pathname.startsWith(path + '/'));
    setShouldShow(!hide);
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
