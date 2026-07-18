/** Public shell for /admin/* including login — no auth here. */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
