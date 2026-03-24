/**
 * Intent classifier — keyword heuristics only, no API calls.
 *
 * Returns: { intent, confidence, techniqueScores, mode: 'keyword' }
 */

export const INTENTS = ['debugging', 'reasoning', 'generation', 'decision', 'review', 'explanation', 'refactoring', 'architecture'];

const KEYWORD_PATTERNS = {
  debugging: [
    /\b(bug|error|fail|crash|broken|not work|doesn't work|issue|problem|exception|stack.?trace|undefined|null pointer|segfault|panic)\b/gi,
    /\b(debug|fix|diagnose|troubleshoot|investigate|why (is|does|did|isn't|doesn't))\b/gi,
  ],
  reasoning: [
    /\b(think|reason|analyze|consider|evaluate|assess|pros? and cons?|trade.?off|compare|weigh)\b/gi,
    /\b(why|how does|what if|suppose|assume|hypothesis|implication)\b/gi,
    /\b(step.?by.?step|walk me through|explain your reasoning)\b/gi,
  ],
  generation: [
    /\b(write|create|generate|build|implement|make|draft|compose|produce)\b/gi,
    /\b(function|class|module|component|script|program|application|api|endpoint)\b/gi,
  ],
  decision: [
    /\b(should I|which (is|should|would)|best (way|approach|option|choice)|recommend|suggest|prefer|choose|decide|pick)\b/gi,
    /\b(vs\.?|versus|alternative)\b/gi,
  ],
  review: [
    /\b(review|check|look at|audit|inspect|validate|verify|critique|feedback|improve|optimize)\b/gi,
    /\b(is this (correct|right|good|ok|fine)|what do you think|thoughts on|opinion on)\b/gi,
  ],
  explanation: [
    /\b(explain|describe|what is|what are|how (does|do|is|are)|tell me about|help me understand|clarify)\b/gi,
    /\b(difference between|meaning of|definition|concept|overview|summary)\b/gi,
  ],
  refactoring: [
    /\b(refactor|restructure|reorganize|clean up|simplify|rewrite|improve|modernize|migrate)\b/gi,
    /\b(technical debt|code smell|duplication|coupling|cohesion)\b/gi,
  ],
  architecture: [
    /\b(architect|design|structure|system|scalab|pattern|framework|infrastructure|database schema|data model)\b/gi,
    /\b(microservice|monolith|event.?driven|domain.?driven|cqrs|rest|graphql)\b/gi,
  ],
};

// Technique scores per intent [chain-of-thought, few-shot, tree-of-thought, meta, role, self-consistency, step-back, react]
export const INTENT_TECHNIQUE_AFFINITY = {
  debugging:    [0.9, 0.7, 0.4, 0.5, 0.6, 0.8, 0.7, 0.9],
  reasoning:    [0.9, 0.5, 0.9, 0.7, 0.4, 0.9, 0.8, 0.6],
  generation:   [0.6, 0.9, 0.3, 0.8, 0.7, 0.4, 0.5, 0.5],
  decision:     [0.8, 0.6, 0.9, 0.6, 0.5, 0.9, 0.7, 0.5],
  review:       [0.7, 0.8, 0.5, 0.7, 0.8, 0.6, 0.6, 0.6],
  explanation:  [0.8, 0.8, 0.4, 0.6, 0.7, 0.5, 0.9, 0.4],
  refactoring:  [0.7, 0.7, 0.5, 0.6, 0.7, 0.6, 0.6, 0.7],
  architecture: [0.6, 0.5, 0.8, 0.9, 0.8, 0.7, 0.8, 0.5],
};

export function classify(prompt) {
  const scores = {};
  for (const [intent, patterns] of Object.entries(KEYWORD_PATTERNS)) {
    let score = 0;
    for (const pattern of patterns) {
      const matches = prompt.match(pattern);
      if (matches) score += matches.length;
    }
    scores[intent] = score;
  }

  const topIntent = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = total > 0 ? topIntent[1] / total : 0;

  const intent = topIntent[1] > 0 ? topIntent[0] : 'generation';
  return {
    intent,
    confidence: Math.min(confidence * 2, 1),
    techniqueScores: INTENT_TECHNIQUE_AFFINITY[intent],
    mode: 'keyword',
  };
}
