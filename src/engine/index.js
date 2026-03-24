/**
 * Enhancement engine — orchestrates:
 *   classify → score → select → rewrite
 *
 * Merges global config with per-project .prompte config.
 */

import { classify } from '../classifier/index.js';
import { TECHNIQUES } from '../techniques/library.js';
import { getConfig, getProjectConfig, getTechniqueWeights } from '../config/profile.js';

/**
 * Score each technique given:
 *   - classifier's techniqueScores (model affinity)
 *   - user's learned acceptance weights
 *   - config preferences / disabled list
 */
function scoreTechniques(techniqueScores, config) {
  const weights = getTechniqueWeights();

  return TECHNIQUES.map((technique, i) => {
    if (config.disabledTechniques?.includes(technique.id)) {
      return { technique, score: -1 };
    }

    const affinityScore = techniqueScores[i] ?? 0.5;
    const weightScore = weights[technique.id] ?? 1.0;
    const preferenceBoost = config.preferredTechniques?.includes(technique.id) ? 0.2 : 0;

    const score = affinityScore * weightScore + preferenceBoost;
    return { technique, score };
  }).sort((a, b) => b.score - a.score);
}

/**
 * Check if a prompt should be bypassed.
 */
export function shouldBypass(prompt, config) {
  const bypassPrefix = config.bypassPrefix ?? '*';
  if (bypassPrefix && prompt.startsWith(bypassPrefix)) return true;
  if (!config.enabled) return true;
  if (prompt.length > (config.maxPromptLength ?? 4000)) return true;
  return false;
}

/**
 * Enhance a prompt. Returns:
 * {
 *   original: string,
 *   enhanced: string,
 *   technique: { id, name, description },
 *   intent: string,
 *   confidence: number,
 *   classifierMode: string,
 *   bypassed: boolean,
 * }
 */
export async function enhance(prompt, overrideConfig = {}) {
  const globalConfig = getConfig();
  const projectConfig = getProjectConfig();
  const config = { ...globalConfig, ...projectConfig, ...overrideConfig };

  if (shouldBypass(prompt, config)) {
    return {
      original: prompt,
      enhanced: prompt.startsWith(config.bypassPrefix) ? prompt.slice(config.bypassPrefix.length).trimStart() : prompt,
      technique: null,
      intent: null,
      confidence: null,
      classifierMode: null,
      bypassed: true,
    };
  }

  const classification = classify(prompt);
  const { intent, confidence, techniqueScores, mode } = classification;

  const ranked = scoreTechniques(techniqueScores, config);
  const best = ranked[0];

  if (best.score < 0) {
    // All techniques disabled
    return {
      original: prompt,
      enhanced: prompt,
      technique: null,
      intent,
      confidence,
      classifierMode: mode,
      bypassed: false,
    };
  }

  const enhanced = best.technique.apply(prompt);

  return {
    original: prompt,
    enhanced,
    technique: {
      id: best.technique.id,
      name: best.technique.name,
      description: best.technique.description,
    },
    intent,
    confidence,
    classifierMode: mode,
    bypassed: false,
    score: best.score,
  };
}
