'use client';

/**
 * SearchFilter — the dashboard header row combining a client-side search box
 * with the "Add Student" action.
 *
 * This is a controlled component: `value` and `onChange` own the search text
 * (the parent {@link StudentDashboard} filters the visible card grid from it),
 * and `onAdd` opens the create form. It holds no local state of its own.
 *
 * A11Y (per the shared field/control conventions): the search input has a
 * <label htmlFor> bound to its id — kept visually hidden (`sr-only`) since the
 * placeholder and adjacent icon already convey intent — and inherits the
 * global font-size >= 1rem (so iOS never zooms) plus the base focus-visible
 * ring, refined here with Tailwind focus-visible utilities. The Add button is
 * a real <button type="button"> sized to the 48px touch minimum.
 *
 * RESPONSIVE: the input and button stack vertically on mobile and sit on one
 * row from the `sm` breakpoint up, with the search field growing to fill the
 * available space.
 */
import { Plus, Search } from 'lucide-react';

// Stable id linking the visually hidden <label> to the search <input>.
const SEARCH_INPUT_ID = 'student-search';

/**
 * Render the search + add header row.
 */
export default function SearchFilter({
  value,
  onChange,
  onAdd,
}: {
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      {/* Search field grows to fill the row on sm+ screens. */}
      <div className="relative flex-1">
        {/* Bound to the input via htmlFor; hidden visually, exposed to AT. */}
        <label htmlFor={SEARCH_INPUT_ID} className="sr-only">
          Search students by name, major, or student ID
        </label>

        {/* Decorative leading icon; hidden from the accessibility tree. */}
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
        />

        <input
          id={SEARCH_INPUT_ID}
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search by name, major, or ID…"
          className="min-h-[48px] w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-12 pr-4 text-slate-100 placeholder:text-slate-400 backdrop-blur transition focus-visible:border-emerald-400/50 focus-visible:ring-2 focus-visible:ring-emerald-500"
        />
      </div>

      {/* Prominent gradient primary action opening the create form. */}
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-brand-500 px-5 py-3 font-medium text-white shadow-lg transition hover:from-emerald-400 hover:to-brand-400 hover:shadow-emerald-500/20 focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <Plus aria-hidden="true" className="h-5 w-5" />
        Add Student
      </button>
    </div>
  );
}