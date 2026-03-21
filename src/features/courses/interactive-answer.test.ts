import { describe, expect, it } from 'vitest';
import { resolveInteractiveChoiceAnswer } from './interactive-answer.js';

describe('interactive-answer', () => {
  const options = [
    { id: 'option-a', text: 'คำตอบ A' },
    { id: 'option-b', text: 'คำตอบ B' },
  ];

  it('returns the canonical option id when the client submits an option id', () => {
    expect(resolveInteractiveChoiceAnswer(options, 'option-a')).toBe('option-a');
  });

  it('returns the canonical option id when the client submits option text', () => {
    expect(resolveInteractiveChoiceAnswer(options, 'คำตอบ A')).toBe('option-a');
  });

  it('trims the submitted answer before matching against option ids', () => {
    expect(resolveInteractiveChoiceAnswer(options, ' option-b ')).toBe('option-b');
  });

  it('returns null when the submitted choice does not match any option', () => {
    expect(resolveInteractiveChoiceAnswer(options, 'คำตอบที่ไม่มีอยู่จริง')).toBeNull();
  });
});
