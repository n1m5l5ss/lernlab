// `LernLab --mcp` (#148): main only passes bytes between stdio and the MCP server process.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMcpMode, MCP_MESSAGE_MAX, mcpCommand, relayMcp } from './mcp-relay';

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

test('a message longer than the cap is dropped, not buffered; the next one gets through whole', () => {
  assert.equal(MCP_MESSAGE_MAX, 1024 * 1024);
  const sent: unknown[] = [];
  const child = Object.assign(new EventEmitter(), { postMessage: (m: unknown) => void sent.push(m), kill: () => true });
  const stdin = new EventEmitter();
  const errors: string[] = [];
  relayMcp({
    child: child as never,
    stdin: stdin as never,
    stdout: { write: () => true },
    stderr: { write: (s: string) => errors.push(s) },
    exit: () => {},
    maxMessageBytes: 10,
  });
  /** What the server process ends up with: the bytes it got, minus a partial line each reset throws away. */
  const forwarded = () => {
    let text = '';
    for (const m of sent as ({ type: 'in'; chunk: Uint8Array } | { type: 'reset' })[]) {
      if (m.type === 'in') text += Buffer.from(m.chunk).toString();
      if (m.type === 'reset') text = text.slice(0, text.lastIndexOf('\n') + 1);
    }
    return text;
  };
  stdin.emit('data', Buffer.from('{"a":1}\n{"too":"lo'));
  stdin.emit('data', Buffer.from('ng and still going'));
  stdin.emit('data', Buffer.from('…"}\n{"b":2}\n'));
  assert.equal(forwarded(), '{"a":1}\n{"b":2}\n');
  assert.ok(
    sent.some((m) => (m as { type: string }).type === 'reset'),
    'the server drops what it had of that line',
  );
  assert.equal(errors.length, 1);
  // Many short messages in one chunk are fine.
  sent.length = 0;
  stdin.emit('data', Buffer.from('{"c":3}\n{"d":4}\n'));
  assert.equal(forwarded(), '{"c":3}\n{"d":4}\n');
});

test('in --mcp mode main registers no window or file handlers: a double-clicked deck never lands there', () => {
  const main = readFileSync(join(import.meta.dirname, 'main.ts'), 'utf8');
  const body = main.match(/function registerWindowEvents\(\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
  for (const event of ['open-file', 'second-instance', 'activate']) {
    const all = main.match(new RegExp(`app\\.on\\('${event}'`, 'g')) ?? [];
    assert.equal(all.length, 1, event);
    assert.match(body, new RegExp(`app\\.on\\('${event}'`), `${event} is registered in registerWindowEvents`);
  }
  assert.match(main, /\nif \(!mcpMode\) registerWindowEvents\(\);/);
  assert.equal(main.match(/registerWindowEvents\(\)/g)?.length, 2, 'declared once, called once');
});
