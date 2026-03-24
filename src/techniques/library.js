/**
 * Technique library — 8 prompt engineering techniques.
 * Each has: name, description, triggers, apply(prompt) → enhanced prompt
 */

export const TECHNIQUES = [
  {
    id: 'chain-of-thought',
    name: 'Chain of Thought',
    description: 'Guides the model to reason step-by-step before answering',
    triggers: ['reasoning', 'debugging', 'explanation'],
    apply(prompt) {
      if (/think step.?by.?step|let'?s think|reason through/i.test(prompt)) return prompt;
      return `${prompt}\n\nThink through this step-by-step before giving your final answer. Show your reasoning explicitly.`;
    },
  },
  {
    id: 'few-shot',
    name: 'Few-Shot Examples',
    description: 'Provides structural input/output examples to anchor format, pattern, and style',
    triggers: ['generation', 'review', 'refactoring'],
    apply(prompt) {
      if (/for example|e\.g\.|such as|like this|show me an example/i.test(prompt)) return prompt;
      return `Here are examples of the input/output pattern expected:

Example 1:
  Input:  [a simple version of this kind of problem]
  Output: [a correct, well-structured solution with brief reasoning]

Example 2:
  Input:  [a slightly different variant]
  Output: [a correct solution showing how the pattern adapts]

Example 3:
  Input:  [an edge case or more complex variant]
  Output: [a correct solution handling the additional complexity]

Now apply the same pattern to:
${prompt}`;
    },
  },
  {
    id: 'tree-of-thought',
    name: 'Tree of Thought',
    description: 'Three independent agents each explore a different approach; any agent that reaches a dead end stops and reassigns to a new branch',
    triggers: ['decision', 'reasoning', 'architecture'],
    apply(prompt) {
      if (/multiple (approaches|options|paths|solutions)|consider (alternatives|different ways)/i.test(prompt)) return prompt;
      return `Use three independent agents to explore this problem in parallel:

Agent 1 — pick the most conventional approach. Work through it. If at any point you determine this approach is wrong or unworkable, stop immediately, state why, and reassign this agent to a fourth alternative approach instead.

Agent 2 — pick a less obvious or contrarian approach. Work through it. If at any point you determine this approach is wrong or unworkable, stop immediately, state why, and reassign this agent to a different alternative approach instead.

Agent 3 — pick the approach you personally find most promising. Work through it. If at any point you determine this approach is wrong or unworkable, stop immediately, state why, and reassign this agent to a different alternative approach instead.

After all three agents have completed (or reassigned), compare their conclusions and recommend the strongest approach with justification.

Problem: ${prompt}`;
    },
  },
  {
    id: 'meta-prompting',
    name: 'Meta-Prompting',
    description: 'Structure-oriented: uses syntax and abstract examples as a guiding template, drawing from type theory to categorise and arrange components before solving',
    triggers: ['architecture', 'generation', 'decision'],
    apply(prompt) {
      if (/clarify|restate|rephrase|make sure (i|you) understand/i.test(prompt)) return prompt;
      return `Problem Statement:
  • Problem: ${prompt}

Solution Structure:
  1. Begin with "Let's think step by step."
  2. Identify and categorise the key components of the problem (inputs, outputs, constraints, relationships).
  3. Express the structure of the solution abstractly before filling in specifics — use syntax and type-level thinking as a scaffold (e.g. "this is a transformation from X → Y where...").
  4. Work through the reasoning steps, ensuring each step follows logically from the last.
  5. End with the final answer clearly stated: "The answer is [final answer]."

Apply this structure to solve the problem above.`;
    },
  },
  {
    id: 'role-prompting',
    name: 'Role Prompting',
    description: 'Frames the model as a domain expert for richer answers',
    triggers: ['review', 'architecture', 'generation'],
    apply(prompt) {
      if (/you are (a|an|the)|act as|pretend (you are|to be)|as an? expert/i.test(prompt)) return prompt;
      return `You are a senior software engineer with deep expertise in the relevant domain.\n\n${prompt}`;
    },
  },
  {
    id: 'self-consistency',
    name: 'Self-Consistency',
    description: 'Asks the model to verify its answer from multiple angles',
    triggers: ['reasoning', 'debugging', 'decision'],
    apply(prompt) {
      if (/verify|double.?check|sanity.?check|confirm|are you sure/i.test(prompt)) return prompt;
      return `${prompt}\n\nAfter giving your answer, verify it by checking from a different angle or with a counterexample. If you find an issue, correct it.`;
    },
  },
  {
    id: 'step-back',
    name: 'Step-Back Prompting',
    description: 'Asks the model to consider the broader context before diving in',
    triggers: ['explanation', 'reasoning', 'architecture'],
    apply(prompt) {
      if (/broader context|big picture|step back|fundamentally|underlying/i.test(prompt)) return prompt;
      return `First, take a step back and consider the broader context and first principles relevant to this question. Then answer:\n\n${prompt}`;
    },
  },
  {
    id: 'react',
    name: 'ReAct (Reason + Act)',
    description: 'Interleaves reasoning and action steps for complex multi-step tasks',
    triggers: ['debugging', 'generation', 'refactoring'],
    apply(prompt) {
      if (/thought:|action:|observation:|reason.*then.*act/i.test(prompt)) return prompt;
      return `Work through this using the ReAct pattern — alternate between Thought (reasoning) and Action (what you would do), then give a final Answer.\n\n${prompt}`;
    },
  },
];

export function getTechnique(id) {
  return TECHNIQUES.find(t => t.id === id);
}

export function getTechniqueNames() {
  return TECHNIQUES.map(t => t.id);
}
