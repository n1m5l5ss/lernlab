// LernLab's MCP server on stdin/stdout, for running from source (web dev mode, tests, scripts):
//   LERNLAB_DATA=/path/to/data node node_modules/tsx/dist/cli.mjs apps/desktop/backend/mcp-stdio.ts
// The desktop app does the same with `LernLab --mcp` (electron/mcp-relay.ts and backend/mcp-process.ts).
// Nothing may be written to stdout except protocol messages, so logs go to stderr.
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { openAppDbReadonly } from '@lernlab/storage-sqlite';
import { createMcpServer } from './mcp';

console.log = console.error;
void createMcpServer({ openDb: () => openAppDbReadonly() }).connect(new StdioServerTransport());
