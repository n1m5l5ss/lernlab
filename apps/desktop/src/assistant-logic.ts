// Settings → AI assistant (#148): the snippet an MCP client needs to start LernLab's server.
import type { AssistantCommand } from '../backend/handlers';

/** The `mcpServers` entry for Claude Desktop and other clients that read the same JSON shape. */
export function clientConfig(cmd: AssistantCommand): string {
  const server = { command: cmd.command, args: cmd.args, ...(cmd.env && { env: cmd.env }) };
  return JSON.stringify({ mcpServers: { lernlab: server } }, null, 2);
}
