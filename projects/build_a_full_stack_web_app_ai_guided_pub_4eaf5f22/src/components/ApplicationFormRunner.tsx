'use client';

/**
 * Compatibility re-export — ApplicationFormRunner lives in DynamicForm
 * after merge with main (submission review, migration, AI guide).
 * Must be a client module so Next does not treat this barrel as a server boundary.
 */
export { ApplicationFormRunner } from '@/components/DynamicForm';
