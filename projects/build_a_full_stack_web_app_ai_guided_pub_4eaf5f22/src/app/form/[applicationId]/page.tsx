import { redirect } from 'next/navigation';

/** Legacy path — citizen flow lives under /user. */
export default async function LegacyFormRedirect({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  redirect(`/user/form/${encodeURIComponent(applicationId)}`);
}