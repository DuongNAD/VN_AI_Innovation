/**
 * Shared Vitest setup file.
 *
 * Registered via `setupFiles` in vitest.config.ts and executed once before the
 * test suites in every environment. Its sole job is to import
 * '@testing-library/jest-dom', which augments Vitest's `expect` with the
 * jest-dom custom matchers (e.g. toHaveFocus, toBeDisabled, toHaveAttribute,
 * aria-invalid checks) that the jsdom component tests
 * (StudentForm.dom.test.tsx and DeleteDialog.dom.test.tsx) rely on.
 *
 * This import is harmless for the node-environment suites (validation and route
 * handler tests): they simply never invoke the DOM matchers it registers.
 */
import '@testing-library/jest-dom';