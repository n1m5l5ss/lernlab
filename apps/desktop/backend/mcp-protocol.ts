// Messages between main and the MCP server process in `LernLab --mcp` mode (#148). Main passes the
// assistant's stdin through as raw chunks and writes each framed reply line to stdout. Pure: main imports it.

/** Main → MCP process: bytes from stdin, or stdin has closed. */
export type RelayIn = { type: 'in'; chunk: Uint8Array } | { type: 'end' };
/** MCP process → main: one serialized JSON-RPC message, newline included. */
export type RelayOut = { type: 'out'; line: string };

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;

export const isRelayIn = (x: unknown): x is RelayIn =>
  isObject(x) && ((x.type === 'in' && x.chunk instanceof Uint8Array) || x.type === 'end');

export const isRelayOut = (x: unknown): x is RelayOut =>
  isObject(x) && x.type === 'out' && typeof x.line === 'string' && x.line.endsWith('\n');
