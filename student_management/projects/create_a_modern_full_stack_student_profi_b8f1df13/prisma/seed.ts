/**
 * Database seed script for the Student Profile System.
 *
 * Populates a handful of diverse sample students so the dashboard renders a
 * non-empty first view before any records are created through the UI. Run via
 * `npm run db:seed` (executed with tsx).
 *
 * Idempotency: each student is written with `upsert` keyed on the unique
 * `studentId`, so re-running the seed updates existing rows in place rather
 * than creating duplicates.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Sample students spanning a range of majors and GPAs across the full
 * 0.0–4.0 scale, so summary metrics and the per-card GPA color thresholds
 * (emerald/amber/rose) are all exercised out of the box.
 */
const students = [
  {
    studentId: 'S1001',
    fullName: 'Ada Lovelace',
    email: 'ada.lovelace@example.edu',
    major: 'Computer Science',
    gpa: 3.95,
  },
  {
    studentId: 'S1002',
    fullName: 'Grace Hopper',
    email: 'grace.hopper@example.edu',
    major: 'Mathematics',
    gpa: 3.6,
  },
  {
    studentId: 'S1003',
    fullName: 'Marie Curie',
    email: 'marie.curie@example.edu',
    major: 'Physics',
    gpa: 2.85,
  },
  {
    studentId: 'S1004',
    fullName: 'Charles Darwin',
    email: 'charles.darwin@example.edu',
    major: 'Biology',
    gpa: 3.1,
  },
  {
    studentId: 'S1005',
    fullName: 'John Nash',
    email: 'john.nash@example.edu',
    major: 'Economics',
    gpa: 1.9,
  },
  {
    studentId: 'S1006',
    fullName: 'Nikola Tesla',
    email: 'nikola.tesla@example.edu',
    major: 'Electrical Engineering',
    gpa: 0.75,
  },
];

/**
 * Upsert every sample student. Keying on the unique `studentId` keeps the
 * operation idempotent: existing rows are refreshed with the seed values and
 * missing rows are created.
 */
async function main(): Promise<void> {
  for (const student of students) {
    await prisma.student.upsert({
      where: { studentId: student.studentId },
      update: student,
      create: student,
    });
  }

  console.log(`Seeded ${students.length} students.`);
}

main()
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });