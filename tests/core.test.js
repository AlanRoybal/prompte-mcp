/**
 * Core tests — classifier, techniques, engine, config
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ─── Classifier ───────────────────────────────────────────────────────────────

describe('Classifier', () => {
  test('classifies debugging prompts', async () => {
    const { classify } = await import('../src/classifier/index.js');
    const result = await classify('why is my code crashing with a null pointer error?');
    assert.equal(result.intent, 'debugging');
    assert.ok(result.confidence > 0);
    assert.equal(result.techniqueScores.length, 8);
    assert.equal(result.mode, 'keyword');
  });

  test('classifies generation prompts', async () => {
    const { classify } = await import('../src/classifier/index.js');
    const result = await classify('write a function to parse JSON');
    assert.equal(result.intent, 'generation');
  });

  test('classifies reasoning prompts', async () => {
    const { classify } = await import('../src/classifier/index.js');
    const result = await classify('analyze the pros and cons of this approach and explain why');
    assert.equal(result.intent, 'reasoning');
  });

  test('classifies decision prompts', async () => {
    const { classify } = await import('../src/classifier/index.js');
    const result = await classify('should I use React or Vue for this project?');
    assert.equal(result.intent, 'decision');
  });

  test('classifies review prompts', async () => {
    const { classify } = await import('../src/classifier/index.js');
    const result = await classify('review this code and check if it is correct');
    assert.equal(result.intent, 'review');
  });

  test('classifies explanation prompts', async () => {
    const { classify } = await import('../src/classifier/index.js');
    const result = await classify('explain how async/await works in JavaScript');
    assert.equal(result.intent, 'explanation');
  });

  test('classifies architecture prompts', async () => {
    const { classify } = await import('../src/classifier/index.js');
    const result = await classify('design a microservice architecture for this system');
    assert.equal(result.intent, 'architecture');
  });

  test('falls back to generation for unknown prompts', async () => {
    const { classify } = await import('../src/classifier/index.js');
    const result = await classify('hello');
    assert.ok(result.intent);
    assert.ok(Array.isArray(result.techniqueScores));
  });

  test('returns 8 technique scores', async () => {
    const { classify } = await import('../src/classifier/index.js');
    const result = await classify('fix this bug');
    assert.equal(result.techniqueScores.length, 8);
    result.techniqueScores.forEach(s => {
      assert.ok(s >= 0 && s <= 1, `Score out of range: ${s}`);
    });
  });

  test('confidence is between 0 and 1', async () => {
    const { classify } = await import('../src/classifier/index.js');
    const result = await classify('write me a function');
    assert.ok(result.confidence >= 0 && result.confidence <= 1);
  });
});

// ─── Techniques ───────────────────────────────────────────────────────────────

describe('Techniques', () => {
  test('exports 8 techniques', async () => {
    const { TECHNIQUES } = await import('../src/techniques/library.js');
    assert.equal(TECHNIQUES.length, 8);
  });

  test('each technique has required fields', async () => {
    const { TECHNIQUES } = await import('../src/techniques/library.js');
    for (const t of TECHNIQUES) {
      assert.ok(t.id, 'Missing id');
      assert.ok(t.name, 'Missing name');
      assert.ok(t.description, 'Missing description');
      assert.ok(Array.isArray(t.triggers), 'Missing triggers');
      assert.equal(typeof t.apply, 'function', 'Missing apply');
    }
  });

  test('chain-of-thought adds step-by-step instruction', async () => {
    const { getTechnique } = await import('../src/techniques/library.js');
    const t = getTechnique('chain-of-thought');
    const enhanced = t.apply('Solve this problem');
    assert.ok(enhanced.toLowerCase().includes('step'));
  });

  test('chain-of-thought is idempotent', async () => {
    const { getTechnique } = await import('../src/techniques/library.js');
    const t = getTechnique('chain-of-thought');
    const once = t.apply('Think step-by-step through this');
    const twice = t.apply(once);
    assert.equal(once, twice);
  });

  test('few-shot adds example instruction', async () => {
    const { getTechnique } = await import('../src/techniques/library.js');
    const t = getTechnique('few-shot');
    const enhanced = t.apply('Write a hello world function');
    assert.ok(enhanced.toLowerCase().includes('example'));
  });

  test('tree-of-thought adds multiple approaches', async () => {
    const { getTechnique } = await import('../src/techniques/library.js');
    const t = getTechnique('tree-of-thought');
    const enhanced = t.apply('Should I use Postgres or MongoDB?');
    assert.ok(enhanced.toLowerCase().includes('approach') || enhanced.toLowerCase().includes('perspective'));
  });

  test('meta-prompting structures problem and solution', async () => {
    const { getTechnique } = await import('../src/techniques/library.js');
    const t = getTechnique('meta-prompting');
    const enhanced = t.apply('Build me an API');
    assert.ok(enhanced.toLowerCase().includes('problem statement'));
    assert.ok(enhanced.toLowerCase().includes('solution structure'));
  });

  test('role-prompting adds expert framing', async () => {
    const { getTechnique } = await import('../src/techniques/library.js');
    const t = getTechnique('role-prompting');
    const enhanced = t.apply('Review this code');
    assert.ok(enhanced.toLowerCase().includes('senior') || enhanced.toLowerCase().includes('expert'));
  });

  test('role-prompting is idempotent when role already present', async () => {
    const { getTechnique } = await import('../src/techniques/library.js');
    const t = getTechnique('role-prompting');
    const withRole = 'You are a senior engineer. Review this.';
    assert.equal(t.apply(withRole), withRole);
  });

  test('self-consistency adds verification step', async () => {
    const { getTechnique } = await import('../src/techniques/library.js');
    const t = getTechnique('self-consistency');
    const enhanced = t.apply('Is this algorithm correct?');
    assert.ok(enhanced.toLowerCase().includes('verify') || enhanced.toLowerCase().includes('check'));
  });

  test('step-back adds broader context instruction', async () => {
    const { getTechnique } = await import('../src/techniques/library.js');
    const t = getTechnique('step-back');
    const enhanced = t.apply('Explain recursion');
    assert.ok(enhanced.toLowerCase().includes('step back') || enhanced.toLowerCase().includes('broader'));
  });

  test('react adds thought/action pattern', async () => {
    const { getTechnique } = await import('../src/techniques/library.js');
    const t = getTechnique('react');
    const enhanced = t.apply('Debug this function');
    assert.ok(enhanced.toLowerCase().includes('thought') || enhanced.toLowerCase().includes('action'));
  });

  test('getTechniqueNames returns 8 ids', async () => {
    const { getTechniqueNames } = await import('../src/techniques/library.js');
    const names = getTechniqueNames();
    assert.equal(names.length, 8);
  });
});

// ─── Engine ───────────────────────────────────────────────────────────────────

describe('Engine', () => {
  test('enhance returns expected shape', async () => {
    const { enhance } = await import('../src/engine/index.js');
    const result = await enhance('fix this bug in my code');
    assert.ok('original' in result);
    assert.ok('enhanced' in result);
    assert.ok('bypassed' in result);
    assert.equal(result.original, 'fix this bug in my code');
    assert.equal(result.bypassed, false);
  });

  test('bypass prefix skips enhancement', async () => {
    const { enhance } = await import('../src/engine/index.js');
    const result = await enhance('* just send this as-is');
    assert.equal(result.bypassed, true);
    assert.equal(result.enhanced, 'just send this as-is');
  });

  test('enhancement changes the prompt for debugging intent', async () => {
    const { enhance } = await import('../src/engine/index.js');
    const result = await enhance('why does my function crash when input is null?');
    assert.notEqual(result.enhanced, result.original);
    assert.ok(result.technique);
  });

  test('disabled technique is excluded', async () => {
    const { enhance } = await import('../src/engine/index.js');
    const result = await enhance('design a system architecture', {
      disabledTechniques: ['chain-of-thought', 'few-shot', 'tree-of-thought', 'meta-prompting',
                           'role-prompting', 'self-consistency', 'step-back', 'react'],
    });
    assert.equal(result.technique, null);
  });

  test('preferred technique is boosted', async () => {
    const { enhance } = await import('../src/engine/index.js');
    // Disable all except chain-of-thought to ensure it wins
    const all = ['few-shot', 'tree-of-thought', 'meta-prompting', 'role-prompting', 'self-consistency', 'step-back', 'react'];
    const result = await enhance('write a sorting function', {
      preferredTechniques: ['chain-of-thought'],
      disabledTechniques: all,
    });
    // When all others are disabled, chain-of-thought must be used
    assert.equal(result.technique?.id, 'chain-of-thought');
  });

  test('shouldBypass respects enabled=false', async () => {
    const { shouldBypass } = await import('../src/engine/index.js');
    assert.equal(shouldBypass('hello', { enabled: false }), true);
    assert.equal(shouldBypass('hello', { enabled: true }), false);
  });

  test('shouldBypass respects maxPromptLength', async () => {
    const { shouldBypass } = await import('../src/engine/index.js');
    const longPrompt = 'a'.repeat(5000);
    assert.equal(shouldBypass(longPrompt, { enabled: true, maxPromptLength: 4000 }), true);
  });
});

// ─── Config ───────────────────────────────────────────────────────────────────

describe('Config', () => {
  test('getConfig returns an object with defaults', async () => {
    const { getConfig } = await import('../src/config/profile.js');
    const config = getConfig();
    assert.equal(typeof config, 'object');
    assert.ok('enabled' in config);
    assert.ok('bypassPrefix' in config);
  });

  test('getStats returns decisions and stats keys', async () => {
    const { getStats } = await import('../src/config/profile.js');
    const stats = getStats();
    assert.ok('decisions' in stats);
    assert.ok('stats' in stats);
  });

  test('getAcceptanceRate returns 0.5 for unknown technique', async () => {
    const { getAcceptanceRate } = await import('../src/config/profile.js');
    const rate = getAcceptanceRate('nonexistent-technique-xyz');
    assert.equal(rate, 0.5);
  });

  test('recordDecision stores and retrieves data', async () => {
    const { recordDecision, getStats } = await import('../src/config/profile.js');
    const before = getStats().decisions.length;
    recordDecision({ prompt: 'test', technique: 'chain-of-thought', accepted: true });
    const after = getStats().decisions.length;
    assert.equal(after, before + 1);
  });

  test('getTechniqueWeights returns weights for all techniques', async () => {
    const { getTechniqueWeights } = await import('../src/config/profile.js');
    const weights = getTechniqueWeights();
    assert.equal(typeof weights, 'object');
  });
});
