// Input fields for the AI assistant's tools and requests (#148): one definition gives both the check (the
// same validators as the window's requests, validate.ts) and the JSON Schema the assistant is shown.
import { InvalidInput, v, type Check } from './validate';

export type Json = Record<string, unknown>;
export type Field<T> = { check: Check<T>; schema: Json; optional?: true };
export type Shape = Record<string, Field<unknown>>;
export type Input<S extends Shape> = { [K in keyof S]: S[K] extends Field<infer T> ? T : never };

const int =
  (min: number, max: number): Check<number> =>
  (value, path = '') => {
    const n = v.number(value, path);
    if (!Number.isInteger(n) || n < min || n > max)
      throw new InvalidInput(`${path || 'input'} must be a whole number from ${min} to ${max}`);
    return n;
  };
const date: Check<string> = (value, path = '') => {
  const s = v.string(10)(value, path);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new InvalidInput(`${path || 'input'} must be a date (YYYY-MM-DD)`);
  return s;
};

export const f = {
  id: (description: string): Field<number> => ({ check: v.id, schema: { type: 'integer', minimum: 1, description } }),
  int: (min: number, max: number, description: string): Field<number> => ({
    check: int(min, max),
    schema: { type: 'integer', minimum: min, maximum: max, description },
  }),
  text: (max: number, description: string): Field<string> => ({
    check: v.string(max),
    schema: { type: 'string', maxLength: max, description },
  }),
  date: (description: string): Field<string> => ({
    check: date,
    schema: { type: 'string', format: 'date', description },
  }),
  oneOf: <T extends string>(options: readonly T[], description: string): Field<T> => ({
    check: v.oneOf(...options),
    schema: { type: 'string', enum: options, description },
  }),
  list: <T>(item: Field<T>, max: number, description: string): Field<T[]> => ({
    check: v.array(item.check, max),
    schema: { type: 'array', items: item.schema, maxItems: max, description },
  }),
  object: <S extends Shape>(shape: S, description?: string): Field<Input<S>> => ({
    check: v.object(Object.fromEntries(Object.entries(shape).map(([k, x]) => [k, x.check]))) as Check<Input<S>>,
    schema: {
      type: 'object',
      properties: Object.fromEntries(Object.entries(shape).map(([k, x]) => [k, x.schema])),
      required: Object.keys(shape).filter((k) => !shape[k].optional),
      additionalProperties: false,
      ...(description && { description }),
    },
  }),
  optional: <T>(x: Field<T>): Field<T | undefined> => ({
    check: v.optional(x.check),
    schema: x.schema,
    optional: true,
  }),
};
