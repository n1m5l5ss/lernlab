import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientConfig } from './assistant-logic';

test('the setup snippet is a Claude Desktop mcpServers entry that starts LernLab with --mcp', () => {
  const win = 'C:\\Users\\Ana\\AppData\\Local\\Programs\\LernLab\\LernLab.exe';
  assert.deepEqual(JSON.parse(clientConfig({ command: win, args: ['--mcp'] })), {
    mcpServers: { lernlab: { command: win, args: ['--mcp'] } },
  });
  const dev = JSON.parse(clientConfig({ command: 'node', args: ['tsx', 'mcp-stdio.ts'], env: { LERNLAB_DATA: '/d' } }));
  assert.deepEqual(dev.mcpServers.lernlab.env, { LERNLAB_DATA: '/d' });
});
