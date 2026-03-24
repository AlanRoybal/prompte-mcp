/**
 * Profile & config management.
 * Stores data at ~/.prompte/config.json and ~/.prompte/decisions.json
 * Also loads per-project .prompte config by walking up the directory tree.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

const PROMPTE_DIR = join(homedir(), '.prompte');
const CONFIG_FILE = join(PROMPTE_DIR, 'config.json');
const DECISIONS_FILE = join(PROMPTE_DIR, 'decisions.json');

function ensureDir() {
  if (!existsSync(PROMPTE_DIR)) mkdirSync(PROMPTE_DIR, { recursive: true });
}

function readJSON(file, fallback = {}) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJSON(file, data) {
  ensureDir();
  writeFileSync(file, JSON.stringify(data, null, 2));
}

// --- Global config ---

const DEFAULT_CONFIG = {
  enabled: true,
  autoAccept: false,
  bypassPrefix: '*',
  preferredTechniques: [],
  disabledTechniques: [],
  maxPromptLength: 4000,
};

export function getConfig() {
  const stored = readJSON(CONFIG_FILE);
  return { ...DEFAULT_CONFIG, ...stored };
}

export function setConfig(key, value) {
  const config = getConfig();
  config[key] = value;
  writeJSON(CONFIG_FILE, config);
  return config;
}

// --- Per-project config ---
// Looks for .prompte file in cwd and parent directories

export function getProjectConfig(startDir = process.cwd()) {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, '.prompte');
    if (existsSync(candidate)) {
      try {
        return JSON.parse(readFileSync(candidate, 'utf8'));
      } catch {
        return {};
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return {};
}

// --- Decision tracking ---

export function recordDecision({ prompt, technique, accepted, helpful = null }) {
  const decisions = readJSON(DECISIONS_FILE, { decisions: [], stats: {} });

  decisions.decisions.push({
    timestamp: Date.now(),
    promptLength: prompt.length,
    technique,
    accepted,
    helpful,
  });

  // Update stats per technique
  if (!decisions.stats[technique]) {
    decisions.stats[technique] = { shown: 0, accepted: 0, helpful: 0, unhelpful: 0 };
  }
  decisions.stats[technique].shown++;
  if (accepted) decisions.stats[technique].accepted++;
  if (helpful === true) decisions.stats[technique].helpful++;
  if (helpful === false) decisions.stats[technique].unhelpful++;

  // Keep last 500 decisions
  if (decisions.decisions.length > 500) {
    decisions.decisions = decisions.decisions.slice(-500);
  }

  writeJSON(DECISIONS_FILE, decisions);
}

export function getStats() {
  return readJSON(DECISIONS_FILE, { decisions: [], stats: {} });
}

export function getAcceptanceRate(techniqueId) {
  const { stats } = getStats();
  const s = stats[techniqueId];
  if (!s || s.shown === 0) return 0.5; // neutral prior
  return s.accepted / s.shown;
}

export function getTechniqueWeights() {
  const { stats } = getStats();
  const weights = {};
  for (const [id, s] of Object.entries(stats)) {
    if (s.shown === 0) {
      weights[id] = 1.0;
    } else {
      // Acceptance rate with Laplace smoothing
      weights[id] = (s.accepted + 1) / (s.shown + 2);
    }
  }
  return weights;
}
