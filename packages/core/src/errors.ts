// Failures people see. `code` is stable and names the translation (errors.<code> in locales/<code>.json);
// `params` fills its {{placeholders}}; `message` is the English fallback for logs and scripts.

export class UserError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly params?: Record<string, string | number>,
  ) {
    super(message);
  }
}
