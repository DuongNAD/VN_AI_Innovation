import { redirect } from 'next/navigation';

/** Legacy path — citizen flow lives under /user. */
export default async function LegacyResultRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') qs.set(key, value);
    else if (Array.isArray(value)) value.forEach((v) => qs.append(key, v));
  }
  const q = qs.toString();
  redirect(q ? `/user/result?${q}` : '/user/result');
}
