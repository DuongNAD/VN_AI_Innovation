/**
 * Aggregate summary metrics for the student dashboard.
 *
 * A pure presentational component (no hooks, no state) rendered inside the
 * client component tree. It receives the FULL student list and always reports
 * metrics over that complete dataset — per the project's summary-scope
 * decision, the search box filters only the visible card grid, never these
 * numbers.
 *
 * Three metrics are shown:
 *   - Total students        (count).
 *   - Average GPA           (mean of every gpa, fixed to 2 decimals, or '—').
 *   - Top major             (the major with the highest count; first-seen wins
 *                            a tie; '—' when there are no students).
 *
 * All aggregates guard the empty-list case so there is no division by zero and
 * the cards degrade to zeros/dashes instead of NaN.
 */
import { Users, GraduationCap, TrendingUp } from 'lucide-react';

/**
 * The client-side shape of a student. Mirrors the type used by
 * StudentDashboard (dates as ISO strings). Only the fields this component
 * reads are relevant, but the full shape is declared for clarity.
 */
type Student = {
  id: number;
  studentId: string;
  fullName: string;
  email: string;
  major: string;
  gpa: number;
  createdAt: string;
  updatedAt: string;
};

/**
 * Compute the average GPA across the given students, rounded to two decimals
 * and rendered as a fixed(2) string. Returns '—' for an empty list so we never
 * divide by zero.
 */
function computeAverageGpa(students: Student[]): string {
  const total = students.length;
  if (total === 0) {
    return '—';
  }
  const sum = students.reduce((acc, student) => acc + student.gpa, 0);
  // Round to 2 decimals, then format with a fixed 2-decimal display.
  const average = Math.round((sum / total) * 100) / 100;
  return average.toFixed(2);
}

/**
 * Determine the most common major. Counts occurrences with a Map (whose
 * insertion order preserves first-seen), and breaks ties in favor of the major
 * encountered first. Returns '—' when there are no students.
 */
function computeTopMajor(students: Student[]): string {
  const counts = new Map<string, number>();
  for (const student of students) {
    counts.set(student.major, (counts.get(student.major) ?? 0) + 1);
  }

  let topMajor = '—';
  let topCount = 0;
  // Map iteration follows insertion order, so the first major to reach a given
  // count keeps the lead — this is the "ties broken by first-seen" rule.
  for (const [major, count] of counts) {
    if (count > topCount) {
      topMajor = major;
      topCount = count;
    }
  }
  return topMajor;
}

/**
 * A single gradient metric card. The numeric/text value uses the display font;
 * the whole card lifts subtly on hover.
 */
function SummaryCard({
  label,
  value,
  icon,
  gradient,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  gradient: string;
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${gradient} p-6 shadow-lg backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-xl`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-200/80">{label}</p>
          <p className="mt-2 truncate font-display text-3xl font-bold text-white sm:text-4xl">
            {value}
          </p>
        </div>
        <span className="rounded-xl bg-white/10 p-3 text-white transition-colors duration-300 group-hover:bg-white/20">
          {icon}
        </span>
      </div>
    </div>
  );
}

/**
 * Render the three summary cards (total students, average GPA, top major) in a
 * responsive grid. Metrics always reflect the full `students` dataset.
 */
export default function SummaryCards({ students }: { students: Student[] }) {
  const total = students.length;
  const averageGpa = computeAverageGpa(students);
  const topMajor = computeTopMajor(students);

  return (
    <section
      aria-label="Summary metrics"
      className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
    >
      <SummaryCard
        label="Total Students"
        value={String(total)}
        icon={<Users className="h-6 w-6" aria-hidden="true" />}
        gradient="from-brand-600/40 to-brand-900/40"
      />
      <SummaryCard
        label="Average GPA"
        value={averageGpa}
        icon={<GraduationCap className="h-6 w-6" aria-hidden="true" />}
        gradient="from-emerald-600/40 to-brand-900/40"
      />
      <SummaryCard
        label="Top Major"
        value={topMajor}
        icon={<TrendingUp className="h-6 w-6" aria-hidden="true" />}
        gradient="from-amber-600/40 to-brand-900/40"
      />
    </section>
  );
}