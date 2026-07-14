/**
 * Root layout for the Student Profile System.
 *
 * Loads the two custom Google fonts via `next/font/google` and exposes each as
 * a CSS variable (`--font-inter` and `--font-outfit`) that the Tailwind
 * `fontFamily` entries (`sans` and `display` in tailwind.config.ts) reference.
 * Both variables are attached to <html> so every descendant can resolve them,
 * and <body> defaults to the `font-sans` (Inter) family. Also imports the
 * global stylesheet that wires up the Tailwind layers and base styling.
 *
 * EDGE CASE: `next/font/google` fetches the Inter and Outfit font files at
 * build time. An offline build therefore cannot download them and will fail
 * here — this is an accepted trade-off for self-hosting the fonts with the
 * automatic CSS-variable wiring next/font provides.
 */
import type { Metadata } from 'next';
import { Inter, Outfit } from 'next/font/google';

import './globals.css';

// Body/UI font. `variable` publishes the font as the `--font-inter` CSS custom
// property, which tailwind.config.ts maps to `fontFamily.sans`.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

// Display/heading font. Published as `--font-outfit`, mapped to
// `fontFamily.display` in tailwind.config.ts.
const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
});

export const metadata: Metadata = {
  title: 'Student Profile System',
  description: 'Manage student profiles',
};

/**
 * The root layout wrapping every page. Both font variables are applied to the
 * <html> element so the custom fonts are available throughout the tree, and
 * <body> uses the `font-sans` (Inter) family by default.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}