// `LernLab --mcp` (#148): main only passes bytes between stdio and the MCP server process.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { isMcpMode, mcpCommand, relayMcp } from './mcp-relay';

test('--mcp turns on the relay mode; the command for Settings fits packaged and dev builds', () => {
  assert.equal(isMcpMode(['/opt/LernLab/lernlab', '--mcp']), true);
  assert.equal(isMcpMode(['/opt/LernLab/lernlab', 'deck.csv']), false);
  assert.deepEqual(mcpCommand('/Applications/LernLab.app/Contents/MacOS/LernLab', true, '/x'), {
    command: '/Applications/LernLab.app/Contents/MacOS/LernLab',
    args: ['--mcp'],
  });
  assert.deepEqual(mcpCommand('/repo/node_modules/electron/dist/electron', false, '/repo/apps/desktop'), {
    command: '/repo/node_modules/electron/dist/electron',
    args: ['/repo/apps/desktop', '--mcp'],
  });
});

test('stdin goes to the server process, its framed replies go to stdout, and nothing else does', () => {
  const sent: unknown[] = [];
  const child = Object.assign(new EventEmitter(), {
    sent,
    postMessage: (m: unknown) => void sent.push(m),
    kill: () => true,
  });
  const stdin = new EventEmitter();
  const written: string[] = [];
  let exitCode: number | null = null;
  relayMcp({
    child: child as never,
    stdin: stdin as never,
    stdout: { write: (line: string) => written.push(line) },
    exit: (code) => (exitCode = code),
  });
  stdin.emit('data', Buffer.from('{"jsonrpc":"2.0"'));
  stdin.emit('data', Buffer.from(',"id":1,"method":"ping"}\n'));
  assert.equal(child.sent.length, 2);
  assert.ok((child.sent[0] as { chunk: Uint8Array }).chunk instanceof Uint8Array);
  child.emit('message', { type: 'out', line: '{"jsonrpc":"2.0","id":1,"result":{}}\n' });
  child.emit('message', { type: 'out', line: 'no newline' });
  child.emit('message', 'console noise');
  assert.deepEqual(written, ['{"jsonrpc":"2.0","id":1,"result":{}}\n']);
  stdin.emit('end');
  assert.deepEqual(child.sent.at(-1), { type: 'end' });
  child.emit('exit', 0);
  assert.equal(exitCode, 0);
});
