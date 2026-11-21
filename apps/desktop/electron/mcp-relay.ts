// `LernLab --mcp` (#148): an AI assistant starts the app this way to use it as a stdio MCP server. No
// window opens and no lock is taken, so it runs next to an open LernLab. Main only passes bytes along:
// stdin to the MCP server process (backend/mcp-process.ts, which opens the database read-only), its
// replies to stdout. Nothing listens on the network or on a socket.
import { isRelayOut, type RelayIn } from '../backend/mcp-protocol';

export const MCP_FLAG = '--mcp';
/** The longest message (one line of JSON) main passes on. Longer ones are dropped instead of buffered. */
export const MCP_MESSAGE_MAX = 1024 * 1024;
export const isMcpMode = (argv: readonly string[]) => argv.includes(MCP_FLAG);

/** The parts of a utilityProcess the relay uses. */
export type RelayChild = {
  postMessage(message: RelayIn): void;
  on(event: 'message', listener: (message: unknown) => void): unknown;
  on(event: 'exit', listener: (code: number) => void): unknown;
  kill(): boolean;
};
type Readable = {
  on(event: 'data', l: (chunk: Uint8Array) => void): unknown;
  on(event: 'end', l: () => void): unknown;
};

/**
 * Wire stdin → child → stdout. `exit` is called with the child's exit code once it stops. Messages are
 * newline-framed; a line longer than `maxMessageBytes` is dropped (with a note on stderr), so a runaway or
 * hostile client cannot make either process buffer without limit.
 */
export function relayMcp(io: {
  child: RelayChild;
  stdin: Readable;
  stdout: { write(line: string): unknown };
  stderr?: { write(line: string): unknown };
  exit: (code: number) => void;
  maxMessageBytes?: number;
}) {
  const { child, stdin, stdout } = io;
  const max = io.maxMessageBytes ?? MCP_MESSAGE_MAX;
  let pending = 0; // bytes of the current line already passed on
  let dropping = false; // the current line is too long: skip to its end
  stdin.on('data', (data) => {
    const chunk = new Uint8Array(data);
    let start = 0;
    while (start < chunk.length) {
      const nl = chunk.indexOf(0x0a, start);
      const end = nl === -1 ? chunk.length : nl + 1;
      const length = end - start;
      if (!dropping && pending + length > max) {
        dropping = true;
        if (pending) child.postMessage({ type: 'reset' });
        io.stderr?.write(`LernLab: dropped an MCP message longer than ${max} bytes\n`);
      }
      if (!dropping) child.postMessage({ type: 'in', chunk: chunk.slice(start, end) });
      if (nl === -1) pending += dropping ? 0 : length;
      else {
        pending = 0;
        dropping = false;
      }
      start = end;
    }
  });
  stdin.on('end', () => child.postMessage({ type: 'end' }));
  child.on('message', (m) => {
    if (isRelayOut(m)) stdout.write(m.line);
  });
  child.on('exit', (code) => io.exit(code));
}

/** How an assistant starts this app's MCP server, for the setup snippet in Settings. */
export function mcpCommand(execPath: string, packaged: boolean, appPath: string) {
  return { command: execPath, args: packaged ? [MCP_FLAG] : [appPath, MCP_FLAG] };
}
