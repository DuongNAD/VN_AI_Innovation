'use client';

import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { useEffect, useState } from 'react';

export default function ChatWidget() {
  const pathname = usePathname();
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    // Không hiển thị widget trên các trang sau:
    // - /chat (trang chat chính, không embed)
    // - /admin (trang quản trị)
    const hideOnPaths = ['/chat', '/admin'];
    const hide = hideOnPaths.some(path => pathname.startsWith(path));
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
