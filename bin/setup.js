#!/usr/bin/env node
/**
 * prompte-mcp setup
 *
 * Usage:
 *   node bin/setup.js          interactive
 *   node bin/setup.js --yes    non-interactive, accept all defaults
 *   node bin/setup.js --dry-run  show what would change, touch nothing
 */

import { createInterface } from 'readline';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { execFileSync } from 'child_process';

const YES = process.argv.includes('--yes');
const DRY = process.argv.includes('--dry-run');

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', green: '\x1b[32m',
  yellow: '\x1b[33m', cyan: '\x1b[36m', dim: '\x1b[2m', red: '\x1b[31m',
};

const rl = YES ? null : createInterface({ input: process.stdin, output: process.stdout });

function log(msg)  { console.log(msg); }
function ok(msg)   { log(`${C.green}✓${C.reset}  ${msg}`); }
function skip(msg) { log(`${C.dim}–  ${msg}${C.reset}`); }
function info(msg) { log(`${C.cyan}→${C.reset}  ${msg}`); }
function warn(msg) { log(`${C.yellow}!${C.reset}  ${msg}`); }
function head(msg) { log(`\n${C.bold}${msg}${C.reset}`); }

async function ask(question, defaultYes = true) {
  if (YES) return defaultYes;
  const hint = defaultYes ? '[Y/n]' : '[y/N]';
  return new Promise(resolve => {
    rl.question(`${question} ${C.dim}${hint}${C.reset} `, answer => {
      const a = answer.trim().toLowerCase();
      resolve(a === '' ? defaultYes : a === 'y');
    });
  });
}


function readJSON(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch { return {}; }
}

function writeJSON(path, data) {
  if (DRY) { info(`[dry-run] would write ${path}`); return; }
  const dir = join(path, '..');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

const ROOT             = resolve(new URL('..', import.meta.url).pathname);
const MCP_JS           = join(ROOT, 'bin', 'prompte-mcp.js');
const HOOK_PY          = join(ROOT, 'hooks', 'user-prompt-submit.py');
const HOME             = homedir();
const CLAUDE_SETTINGS  = join(HOME, '.claude', 'settings.json');

// ─── Steps ───────────────────────────────────────────────────────────────────

function checkNode() {
  head('Checking prerequisites');
  const [major] = process.versions.node.split('.').map(Number);
  if (major < 18) {
    log(`${C.red}✗${C.reset}  Node.js 18+ required (you have ${process.version})`);
    process.exit(1);
  }
  ok(`Node.js ${process.version}`);
  try {
    execFileSync('python3', ['--version'], { stdio: 'pipe' });
    ok('python3 found');
  } catch {
    warn('python3 not found — UserPromptSubmit hook will not work');
  }
}

async function stepMcp() {
  head('Register MCP server');
  const doMcp = await ask('Add Prompte to ~/.claude/settings.json?');
  if (!doMcp) { skip('Skipped'); return; }

  const settings = readJSON(CLAUDE_SETTINGS);
  if (!settings.mcpServers) settings.mcpServers = {};

  const alreadyRegistered = !!settings.mcpServers.prompte;
  settings.mcpServers.prompte = {
    command: 'node',
    args: [MCP_JS],
  };

  writeJSON(CLAUDE_SETTINGS, settings);
  ok(alreadyRegistered ? 'MCP server updated in ~/.claude/settings.json' : 'MCP server registered in ~/.claude/settings.json');
}

async function stepHook() {
  head('UserPromptSubmit hook');
  info('Automatically enhances every prompt. Prefix with * to bypass.');

  const doHook = await ask('Install the UserPromptSubmit hook?');
  if (!doHook) { skip('Skipped'); return; }

  const settings = readJSON(CLAUDE_SETTINGS);
  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.UserPromptSubmit) settings.hooks.UserPromptSubmit = [];

  const alreadyInstalled = settings.hooks.UserPromptSubmit
    .some(entry => JSON.stringify(entry).includes('user-prompt-submit'));

  if (alreadyInstalled) { ok('Hook already installed'); return; }

  settings.hooks.UserPromptSubmit.push({
    matcher: '',
    hooks: [{ type: 'command', command: `python3 ${HOOK_PY}` }],
  });

  writeJSON(CLAUDE_SETTINGS, settings);
  ok('Hook registered in ~/.claude/settings.json');
}

async function stepConfig() {
  head('Default config');
  const configDir  = join(HOME, '.prompte');
  const configFile = join(configDir, 'config.json');

  if (existsSync(configFile)) { ok(`Config already exists at ${configFile}`); return; }

  if (!DRY) {
    if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true });
    writeFileSync(configFile, JSON.stringify({
      enabled: true,
      autoAccept: false,
      bypassPrefix: '*',
      preferredTechniques: [],
      disabledTechniques: [],
      llmClassifier: true,
      maxPromptLength: 4000,
    }, null, 2) + '\n');
  }
  ok(`Default config written to ${configFile}`);
}

function summary() {
  head('Done!');
  log('');
  log('Restart Claude Code to pick up the MCP server and hook.');
  log('');
  log(`${C.bold}Quick test${C.reset} — ask Claude:`);
  log(`  ${C.cyan}"what prompte techniques are available?"${C.reset}`);
  log('');
  log(`${C.dim}Config: ~/.prompte/config.json`);
  log(`Docs:   ${ROOT}/README.md${C.reset}`);
  log('');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log(`\n${C.bold}${C.cyan}Prompte MCP Setup${C.reset}${DRY ? C.yellow + '  [dry-run]' + C.reset : ''}\n`);

  checkNode();
  await stepMcp();
  await stepHook();
  await stepConfig();
  summary();

  rl?.close();
}

main().catch(e => {
  console.error(`\n${C.red}Setup failed:${C.reset} ${e.message}`);
  rl?.close();
  process.exit(1);
});
