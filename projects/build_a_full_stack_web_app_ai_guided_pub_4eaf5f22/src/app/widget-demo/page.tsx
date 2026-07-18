import { redirect } from 'next/navigation';

const NATIONAL_PUBLIC_SERVICE_PORTAL = 'https://dichvucong.gov.vn';

export default function WidgetDemoRedirectPage() {
  redirect(NATIONAL_PUBLIC_SERVICE_PORTAL);
}
