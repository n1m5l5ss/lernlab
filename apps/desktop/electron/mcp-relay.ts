// `LernLab --mcp` (#148): an AI assistant starts the app this way to use it as a stdio MCP server. No
// window opens and no lock is taken, so it runs next to an open LernLab. Main only passes bytes along:
// stdin to the MCP server process (backend/mcp-process.ts, which opens the database read-only), its
// replies to stdout. Nothing listens on the network or on a socket.
import { isRelayOut, type RelayIn } from '../backend/mcp-protocol';

export const MCP_FLAG = '--mcp';
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

/** Wire stdin → child → stdout. `exit` is called with the child's exit code once it stops. */
export function relayMcp(io: {
  child: RelayChild;
  stdin: Readable;
  stdout: { write(line: string): unknown };
  exit: (code: number) => void;
}) {
  const { child, stdin, stdout } = io;
  stdin.on('data', (chunk) => child.postMessage({ type: 'in', chunk: new Uint8Array(chunk) }));
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
