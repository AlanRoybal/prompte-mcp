#!/usr/bin/env node
/**
 * prompte-mcp — MCP server exposing prompt enhancement as Claude Code tools.
 *
 * Tools:
 *   enhance_prompt       — enhance a raw prompt
 *   list_techniques      — list all 8 techniques with stats
 *   get_stats            — session totals + config snapshot
 *   record_feedback      — mark an enhancement helpful/not
 *   get_config           — read ~/.prompte/config.json
 *   set_config           — write a config value
 */

import { enhance } from '../src/engine/index.js';
import { TECHNIQUES } from '../src/techniques/library.js';
import { getConfig, setConfig, getStats, recordDecision } from '../src/config/profile.js';

// MCP stdio transport — read JSON-RPC from stdin, write to stdout
process.stdin.setEncoding('utf8');

let buffer = '';

process.stdin.on('data', (chunk) => {
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop(); // incomplete line
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) handleMessage(trimmed);
  }
});

process.stdin.on('end', () => process.exit(0));

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function sendError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

const sessionStats = { enhanced: 0, accepted: 0, skipped: 0 };

async function handleMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    sendError(null, -32700, 'Parse error');
    return;
  }

  const { id, method, params } = msg;

  if (method === 'initialize') {
    send({
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'prompte-mcp', version: '1.0.0' },
        capabilities: { tools: {} },
      },
    });
    return;
  }

  if (method === 'notifications/initialized') return;

  if (method === 'tools/list') {
    send({
      jsonrpc: '2.0', id,
      result: {
        tools: [
          {
            name: 'enhance_prompt',
            description: 'Enhance a prompt with the best prompt engineering technique for its intent.',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: { type: 'string', description: 'The raw prompt to enhance' },
                technique: { type: 'string', description: 'Force a specific technique ID (optional)' },
              },
              required: ['prompt'],
            },
          },
          {
            name: 'list_techniques',
            description: 'List all 8 available prompt engineering techniques with acceptance stats.',
            inputSchema: { type: 'object', properties: {} },
          },
          {
            name: 'get_stats',
            description: 'Get session totals and current config snapshot.',
            inputSchema: { type: 'object', properties: {} },
          },
          {
            name: 'record_feedback',
            description: 'Record whether an enhancement was helpful.',
            inputSchema: {
              type: 'object',
              properties: {
                technique: { type: 'string', description: 'Technique ID' },
                helpful: { type: 'boolean', description: 'Was it helpful?' },
                prompt: { type: 'string', description: 'The original prompt (for context)' },
              },
              required: ['technique', 'helpful'],
            },
          },
          {
            name: 'get_config',
            description: 'Read the current ~/.prompte/config.json',
            inputSchema: { type: 'object', properties: {} },
          },
          {
            name: 'set_config',
            description: 'Write a config value to ~/.prompte/config.json',
            inputSchema: {
              type: 'object',
              properties: {
                key: { type: 'string', description: 'Config key' },
                value: { description: 'New value' },
              },
              required: ['key', 'value'],
            },
          },
        ],
      },
    });
    return;
  }

  if (method === 'tools/call') {
    const { name, arguments: toolArgs } = params;
    try {
      const result = await dispatch(name, toolArgs ?? {});
      send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] } });
    } catch (err) {
      sendError(id, -32603, err.message);
    }
    return;
  }

  // Unknown method
  sendError(id, -32601, `Method not found: ${method}`);
}

async function dispatch(tool, args) {
  switch (tool) {
    case 'enhance_prompt': {
      const { prompt, technique: forceTechnique } = args;
      if (!prompt) throw new Error('prompt is required');

      let overrides = {};
      if (forceTechnique) {
        const { getTechniqueNames } = await import('../src/techniques/library.js');
        const others = getTechniqueNames().filter(id => id !== forceTechnique);
        overrides = { preferredTechniques: [forceTechnique], disabledTechniques: others };
      }
      const result = await enhance(prompt, overrides);

      sessionStats.enhanced++;
      if (result.technique) sessionStats.accepted++;
      else sessionStats.skipped++;

      // techniqueInstruction tells Claude how to apply the technique with its own
      // intelligence rather than using the static template verbatim.
      const techniqueInstruction = result.technique
        ? `Apply the ${result.technique.name} technique when answering: ${result.technique.description}.`
        : null;

      return {
        original: result.original,
        techniqueInstruction,
        technique: result.technique,
        intent: result.intent,
        confidence: result.confidence,
        bypassed: result.bypassed,
        // enhanced is still included for the UserPromptSubmit hook, which needs
        // a ready-to-use string before Claude sees the prompt at all.
        enhanced: result.enhanced,
      };
    }

    case 'list_techniques': {
      const { stats } = getStats();
      return TECHNIQUES.map(t => {
        const s = stats[t.id] ?? { shown: 0, accepted: 0, helpful: 0 };
        const rate = s.shown > 0 ? Math.round((s.accepted / s.shown) * 100) : null;
        return {
          id: t.id,
          name: t.name,
          description: t.description,
          triggers: t.triggers,
          stats: { shown: s.shown, accepted: s.accepted, acceptanceRate: rate },
        };
      });
    }

    case 'get_stats': {
      const { stats } = getStats();
      return { session: sessionStats, perTechnique: stats, config: getConfig() };
    }

    case 'record_feedback': {
      const { technique, helpful, prompt = '' } = args;
      recordDecision({ prompt, technique, accepted: true, helpful });
      return { recorded: true };
    }

    case 'get_config': {
      return getConfig();
    }

    case 'set_config': {
      const { key, value } = args;
      if (!key) throw new Error('key is required');
      return setConfig(key, value);
    }

    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}
