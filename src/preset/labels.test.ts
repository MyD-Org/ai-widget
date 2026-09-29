import { describe, it, expect } from 'vitest';
import { defaultLabels, labelForError } from './labels';

describe('labelForError', () => {
  it.each([
    ['message_too_long', defaultLabels.errorMessageTooLong],
    ['messages_per_day_user', defaultLabels.errorRateLimit],
    ['tokens_per_day_user', defaultLabels.errorRateLimit],
    ['messages_per_day', defaultLabels.errorRateLimit],
    ['tokens_per_month', defaultLabels.errorRateLimit],
    ['rate_limit', defaultLabels.errorRateLimit],
    ['auth', defaultLabels.errorAuth],
    ['config', defaultLabels.errorConfig],
    ['no_credits', defaultLabels.errorNoCredits],
    ['agent_disabled', defaultLabels.errorNoCredits],
    ['algo_raro', defaultLabels.errorGeneric],
    [undefined, defaultLabels.errorGeneric],
  ])('%s → su label', (code, expected) => {
    expect(labelForError(code, defaultLabels)).toBe(expected);
  });

  it('errorMessageTooLong en texto neutro', () => {
    expect(defaultLabels.errorMessageTooLong).toBe('El mensaje es demasiado largo.');
  });
});
