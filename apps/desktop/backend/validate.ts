// Small input validators for the IPC handlers. The renderer is treated as untrusted:
// every request is checked here before it reaches the engine.

export class InvalidInput extends Error {
  readonly code = 'invalid_input';
}

/** Checks an unknown value and returns it typed, or throws InvalidInput. */
export type Check<T> = (value: unknown, path?: string) => T;

const fail = (path: string, what: string): never => {
  throw new InvalidInput(`${path || 'input'} must be ${what}`);
};

export const v = {
  none: ((value, path = '') =>
    value === undefined || value === null ? undefined : fail(path, 'empty')) as Check<void>,
  string:
    (max = 1_000_000): Check<string> =>
    (value, path = '') =>
      typeof value === 'string' && value.length <= max ? value : fail(path, `text (at most ${max} characters)`),
  number: ((value, path = '') =>
    typeof value === 'number' && Number.isFinite(value) ? value : fail(path, 'a number')) as Check<number>,
  id: ((value, path = '') =>
    Number.isSafeInteger(value) && (value as number) > 0 ? (value as number) : fail(path, 'an id')) as Check<number>,
  boolean: ((value, path = '') => (typeof value === 'boolean' ? value : fail(path, 'true or false'))) as Check<boolean>,
  /** A whole number from `min` to `max`. */
  int:
    (min: number, max: number): Check<number> =>
    (value, path = '') =>
      Number.isInteger(value) && (value as number) >= min && (value as number) <= max
        ? (value as number)
        : fail(path, `a whole number from ${min} to ${max}`),
  bytes:
    (maxBytes: number): Check<Uint8Array> =>
    (value, path = '') =>
      value instanceof Uint8Array && value.length <= maxBytes
        ? value
        : fail(path, `file data (at most ${Math.round(maxBytes / 1024 / 1024)} MB)`),
  oneOf:
    <T extends string>(...options: T[]): Check<T> =>
    (value, path = '') =>
      options.includes(value as T) ? (value as T) : fail(path, `one of ${options.join(', ')}`),
  optional:
    <T>(check: Check<T>): Check<T | undefined> =>
    (value, path) =>
      value === undefined ? undefined : check(value, path),
  nullable:
    <T>(check: Check<T>): Check<T | null> =>
    (value, path) =>
      value === null ? null : check(value, path),
  array:
    <T>(check: Check<T>, max = 10_000): Check<T[]> =>
    (value, path = '') =>
      Array.isArray(value) && value.length <= max
        ? value.map((x, i) => check(x, `${path}[${i}]`))
        : fail(path, `a list (at most ${max} items)`),
  /** Plain JSON data (settings blobs, goals). Only checks it is an object. */
  record: ((value, path = '') =>
    value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Uint8Array)
      ? (value as Record<string, unknown>)
      : fail(path, 'an object')) as Check<Record<string, unknown>>,
  /** An object with these fields. Unknown fields are dropped. */
  object:
    <S extends Record<string, Check<unknown>>>(shape: S): Check<ObjectOf<S>> =>
    (value, path = '') => {
      const obj = v.record(value, path);
      const out: Record<string, unknown> = {};
      for (const [k, check] of Object.entries(shape)) {
        const x = check(obj[k], path ? `${path}.${k}` : k);
        if (x !== undefined) out[k] = x;
      }
      return out as ObjectOf<S>;
    },
};

/** Fields whose check allows `undefined` are optional. */
type ObjectOf<S extends Record<string, Check<unknown>>> = Simplify<
  { [K in keyof S as undefined extends ReturnType<S[K]> ? never : K]: ReturnType<S[K]> } & {
    [K in keyof S as undefined extends ReturnType<S[K]> ? K : never]?: ReturnType<S[K]>;
  }
>;
type Simplify<T> = { [K in keyof T]: T[K] } & {};
