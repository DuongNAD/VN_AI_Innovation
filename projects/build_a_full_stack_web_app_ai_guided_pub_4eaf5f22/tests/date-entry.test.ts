import { describe, expect, it } from 'vitest';
import {
  formatCompletedDateInput,
  formatDateDigits,
} from '@/components/DynamicForm';

describe('DynamicForm · date entry', () => {
  it('does not rewrite partial input while the citizen is still typing', () => {
    expect(formatCompletedDateInput('1')).toBe('1');
    expect(formatCompletedDateInput('11/')).toBe('11/');
    expect(formatCompletedDateInput('11/0')).toBe('11/0');
    expect(formatCompletedDateInput('11/20/6')).toBe('11/20/6');
  });

  it('formats eight digits only after the entry is complete', () => {
    expect(formatCompletedDateInput('11022006')).toBe('11/02/2006');
    expect(formatCompletedDateInput('11/02/2006')).toBe('11/02/2006');
  });

  it('bounds pasted input to the dd/mm/yyyy shape', () => {
    expect(formatDateDigits('11022006123')).toBe('11/02/2006');
  });
});
