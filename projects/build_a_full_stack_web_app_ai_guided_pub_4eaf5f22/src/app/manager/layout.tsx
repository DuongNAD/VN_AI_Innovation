/** Public shell for /manager/* including login — no auth here. */
export default function ManagerRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
