# prompte-mcp

An MCP server that enhances your prompts before Claude processes them — automatically applying chain-of-thought, few-shot, tree-of-thought, and other prompt engineering techniques based on what you're asking.

```
you type:   "fix this null pointer crash"

claude sees: "Work through this using the ReAct pattern — alternate between
              Thought (reasoning) and Action (what you would do), then give
              a final Answer.

              fix this null pointer crash"
```

---

## Setup

No API key needed. Prompte runs entirely on your existing Claude Code or Codex session.

```bash
git clone https://github.com/AlanRoybal/prompte-mcp
cd prompte-mcp
node bin/setup.js
```

The setup script handles everything:

1. Registers the MCP server in `~/.claude/settings.json`
2. Installs the `UserPromptSubmit` hook (automatic enhancement on every prompt)
3. Creates `~/.prompte/config.json` with defaults

Then restart Claude Code.

### Flags

```bash
node bin/setup.js --yes       # accept all defaults, no prompts
node bin/setup.js --dry-run   # preview changes without writing anything
```

### Manual setup

If you prefer to edit `~/.claude/settings.json` directly:

```json
{
  "mcpServers": {
    "prompte": {
      "command": "node",
      "args": ["/path/to/prompte-mcp/bin/prompte-mcp.js"]
    }
  },
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "python3 /path/to/prompte-mcp/hooks/user-prompt-submit.py"
          }
        ]
      }
    ]
  }
}
```

---

## How it works

The MCP server handles classification and technique selection. Claude Code (your existing session) does the actual enhancement — no separate API calls, no extra costs.

```
your prompt
    │
    ▼
┌─────────────┐
│  Classifier │  keyword heuristics (no API call)
│             │  → intent: debugging / reasoning / generation / ...
└──────┬──────┘
       │  technique affinity scores
       ▼
┌─────────────┐
│   Scorer    │  affinity × your learned acceptance rate
│             │  → selects best technique
└──────┬──────┘
       │  techniqueInstruction
       ▼
  Claude Code  ←── applies the technique using its own intelligence
       │
       ▼
    response
```

The scorer learns from you. Acceptance rates per technique are tracked in `~/.prompte/` — techniques you skip get demoted over time.

---

## Two modes

### Automatic (hook)

The `UserPromptSubmit` hook fires on every prompt silently — no tool call, no interruption. Claude receives the enhanced version without you doing anything.

Prefix a prompt with `*` to bypass:
```
* just answer this exactly as asked
```

### Interactive (MCP tools)

When Claude calls `enhance_prompt`, it shows you the enhancement and waits for your decision before answering:

```
I've selected the Chain of Thought technique for this (debugging).

Original: why does my function crash when the list is empty?

Enhanced: Think through this step-by-step before giving your final
          answer. Show your reasoning explicitly.

          why does my function crash when the list is empty?

[A] Accept   [E] Edit   [S] Skip   [Q] Quit
```

Reply with `a` / `e` / `s` / `q` (or just say "accept", "skip", etc.):

| Reply | What happens |
|-------|-------------|
| `a` / accept | Claude answers using the enhanced prompt |
| `e` / edit | Paste your revised version, Claude uses that |
| `s` / skip | Claude answers your original prompt, no technique |
| `q` / quit | Claude stops, does nothing |

Set `autoAccept: true` in `~/.prompte/config.json` to skip the confirmation and apply silently.

Claude Code can also call these tools directly during a session:

| Tool | What it does |
|------|-------------|
| `enhance_prompt` | Classify intent, select best technique, return `techniqueInstruction` for Claude to apply |
| `list_techniques` | All 8 techniques with your acceptance stats |
| `get_stats` | Session totals + current config |
| `record_feedback` | Mark an enhancement helpful/not (trains technique weights) |
| `get_config` | Read `~/.prompte/config.json` |
| `set_config` | Write a config value |

The `CLAUDE.md` in this repo tells Claude when to call `enhance_prompt` automatically — on debugging, reasoning, generation, architecture, and review prompts.

---

## The 8 techniques

| Technique | Best for | What it adds |
|-----------|----------|--------------|
| **Chain of Thought** | Debugging, reasoning | Step-by-step reasoning before answering |
| **Few-Shot** | Generation, review | Concrete example to anchor output |
| **Tree of Thought** | Decisions, architecture | 3 approaches with pros/cons, then a recommendation |
| **Meta-Prompting** | Architecture, generation | Restate understanding of the goal before answering |
| **Role Prompting** | Review, generation | Senior software engineer framing |
| **Self-Consistency** | Reasoning, debugging | Verify from a different angle, correct if wrong |
| **Step-Back** | Explanation, reasoning | Consider broader context and first principles first |
| **ReAct** | Debugging, multi-step | Interleaved Thought / Action / Observation steps |

---

## Configuration

`~/.prompte/config.json`:

```json
{
  "enabled": true,
  "autoAccept": false,
  "bypassPrefix": "*",
  "preferredTechniques": [],
  "disabledTechniques": [],
  "llmClassifier": true,
  "maxPromptLength": 4000
}
```

| Key | Default | Description |
|-----|---------|-------------|
| `enabled` | `true` | Master switch |
| `bypassPrefix` | `"*"` | Prompt prefix to skip enhancement |
| `preferredTechniques` | `[]` | Boost these techniques |
| `disabledTechniques` | `[]` | Never use these techniques |
| `maxPromptLength` | `4000` | Skip enhancement above this length |

Per-project overrides: drop a `.prompte` file anywhere in your project tree (or a parent directory). Values override the global config.

---

## Project structure

```
prompte-mcp/
├── bin/
│   ├── prompte-mcp.js      MCP server
│   └── setup.js            setup script
├── src/
│   ├── classifier/         intent classification (LLM + keyword fallback)
│   ├── techniques/         8 technique definitions
│   ├── engine/             classify → score → select → rewrite
│   └── config/             ~/.prompte/ storage and acceptance rate learning
├── hooks/
│   └── user-prompt-submit.py   UserPromptSubmit hook
└── CLAUDE.md               tells Claude when to call enhance_prompt
```
