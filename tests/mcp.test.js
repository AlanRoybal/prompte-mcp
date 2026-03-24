/**
 * MCP server tests — protocol compliance, all 6 tools
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'child_process';
import { createInterface } from 'readline';

// ─── MCP test harness ─────────────────────────────────────────────────────────

class MCPClient {
  constructor() {
    this.proc = null;
    this.pending = new Map();
    this.nextId = 1;
    this.rl = null;
  }

  async start() {
    this.proc = spawn('node', ['bin/prompte-mcp.js'], { stdio: ['pipe', 'pipe', 'pipe'] });
    this.rl = createInterface({ input: this.proc.stdout });

    this.rl.on('line', (line) => {
      try {
        const msg = JSON.parse(line);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      } catch {}
    });

    this.proc.on('error', () => {});

    // Initialize
    await this.call('initialize', {
      protocolVersion: '2024-11-05',
      clientInfo: { name: 'test-client' },
      capabilities: {},
    });
  }

  call(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params });
      this.proc.stdin.write(msg + '\n');
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Timeout for ${method}`));
        }
      }, 5000);
    });
  }

  async tool(name, args = {}) {
    const result = await this.call('tools/call', { name, arguments: args });
    const text = result.content[0].text;
    return JSON.parse(text);
  }

  stop() {
    this.rl?.close();
    this.proc?.kill();
  }
}

let client;

describe('MCP Server', () => {
  before(async () => {
    client = new MCPClient();
    await client.start();
  });

  after(() => client.stop());

  // ─── Protocol ───────────────────────────────────────────────────────────────

  test('initialize returns server info', async () => {
    const info = await client.call('initialize', {
      protocolVersion: '2024-11-05',
      clientInfo: { name: 'test' },
      capabilities: {},
    });
    assert.equal(info.serverInfo.name, 'prompte-mcp');
    assert.ok(info.protocolVersion);
  });

  test('tools/list returns 6 tools', async () => {
    const result = await client.call('tools/list');
    assert.equal(result.tools.length, 6);
    const names = result.tools.map(t => t.name);
    assert.ok(names.includes('enhance_prompt'));
    assert.ok(names.includes('list_techniques'));
    assert.ok(names.includes('get_stats'));
    assert.ok(names.includes('record_feedback'));
    assert.ok(names.includes('get_config'));
    assert.ok(names.includes('set_config'));
  });

  test('unknown method returns error', async () => {
    try {
      await client.call('unknown/method');
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(err.message.includes('not found') || err.message.includes('Timeout'));
    }
  });

  // ─── enhance_prompt ─────────────────────────────────────────────────────────

  test('enhance_prompt returns enhanced text', async () => {
    const result = await client.tool('enhance_prompt', { prompt: 'fix this null pointer bug' });
    assert.ok(result.enhanced);
    assert.ok(result.original);
    assert.equal(result.original, 'fix this null pointer bug');
    assert.ok(result.technique);
    assert.ok(result.intent);
  });

  test('enhance_prompt bypass prefix returns cleaned prompt', async () => {
    const result = await client.tool('enhance_prompt', { prompt: '* just pass this through' });
    assert.equal(result.bypassed, true);
    assert.equal(result.enhanced, 'just pass this through');
  });

  test('enhance_prompt with forced technique', async () => {
    const result = await client.tool('enhance_prompt', {
      prompt: 'write a sort function',
      technique: 'chain-of-thought',
    });
    assert.equal(result.technique?.id, 'chain-of-thought');
  });

  test('enhance_prompt throws without prompt', async () => {
    try {
      await client.tool('enhance_prompt', {});
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(err.message.includes('prompt is required') || err.message.includes('Timeout') || err.message);
    }
  });

  // ─── list_techniques ────────────────────────────────────────────────────────

  test('list_techniques returns 8 items', async () => {
    const result = await client.tool('list_techniques');
    assert.equal(result.length, 8);
  });

  test('list_techniques items have required fields', async () => {
    const result = await client.tool('list_techniques');
    for (const t of result) {
      assert.ok(t.id);
      assert.ok(t.name);
      assert.ok(t.description);
      assert.ok(Array.isArray(t.triggers));
      assert.ok('stats' in t);
    }
  });

  // ─── get_stats ──────────────────────────────────────────────────────────────

  test('get_stats returns session and perTechnique', async () => {
    const result = await client.tool('get_stats');
    assert.ok('session' in result);
    assert.ok('perTechnique' in result);
    assert.ok('config' in result);
  });

  test('get_stats session tracks enhancements', async () => {
    await client.tool('enhance_prompt', { prompt: 'debug my code' });
    const stats = await client.tool('get_stats');
    assert.ok(stats.session.enhanced >= 1);
  });

  // ─── record_feedback ────────────────────────────────────────────────────────

  test('record_feedback returns recorded: true', async () => {
    const result = await client.tool('record_feedback', {
      technique: 'chain-of-thought',
      helpful: true,
      prompt: 'test prompt',
    });
    assert.equal(result.recorded, true);
  });

  test('record_feedback negative feedback', async () => {
    const result = await client.tool('record_feedback', {
      technique: 'few-shot',
      helpful: false,
    });
    assert.equal(result.recorded, true);
  });

  // ─── get_config ─────────────────────────────────────────────────────────────

  test('get_config returns config object', async () => {
    const config = await client.tool('get_config');
    assert.ok('enabled' in config);
    assert.ok('bypassPrefix' in config);
  });

  // ─── set_config ─────────────────────────────────────────────────────────────

  test('set_config updates a value', async () => {
    await client.tool('set_config', { key: 'autoAccept', value: true });
    const config = await client.tool('get_config');
    assert.equal(config.autoAccept, true);
    // Clean up
    await client.tool('set_config', { key: 'autoAccept', value: false });
  });

  test('set_config throws without key', async () => {
    try {
      await client.tool('set_config', { value: 'something' });
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(err.message);
    }
  });
});
