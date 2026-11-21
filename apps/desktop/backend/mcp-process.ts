// The MCP server process of the desktop app (an Electron utilityProcess, started by `LernLab --mcp`).
// Main relays the assistant's stdin here and our replies back to stdout (electron/mcp-relay.ts), since a
// utilityProcess has no stdin of its own. This process opens the database read-only for each call.
import { ReadBuffer, serializeMessage } from '@modelcontextprotocol/sdk/shared/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { openAppDbReadonly } from '@lernlab/storage-sqlite';
import { createMcpServer } from './mcp';
import { isRelayIn, type RelayOut } from './mcp-protocol';

class ParentPortTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;
  private buffer = new ReadBuffer();

  async start() {
    process.parentPort.on('message', ({ data }) => {
      if (!isRelayIn(data)) return;
      if (data.type === 'end') return void this.close();
      this.buffer.append(Buffer.from(data.chunk));
      try {
        for (let m = this.buffer.readMessage(); m; m = this.buffer.readMessage()) this.onmessage?.(m);
      } catch (e) {
        this.onerror?.(e as Error);
      }
    });
  }
  async send(message: JSONRPCMessage) {
    process.parentPort.postMessage({ type: 'out', line: serializeMessage(message) } satisfies RelayOut);
  }
  async close() {
    this.onclose?.();
    process.exit(0);
  }
}

console.log = console.error;
void createMcpServer({ openDb: () => openAppDbReadonly() }).connect(new ParentPortTransport());
