# Prompte MCP

You have access to a prompt engineering assistant via the `prompte` MCP server.

## When to call `enhance_prompt`

Call it automatically — before formulating your response — when the user's message involves:

- **Debugging**: error messages, crashes, "why does X fail", stack traces
- **Reasoning**: trade-offs, analysis, "think through", algorithm evaluation
- **Generation**: writing code, functions, classes, APIs, scripts
- **Architecture**: system design, data models, infrastructure decisions
- **Review**: code review, auditing, checking correctness

Do not call it for: simple factual questions, conversational messages, or prompts
that already contain explicit reasoning instructions. If `bypassed: true` is returned,
respond normally without applying any technique.

## What to do with the result

Call `enhance_prompt({ prompt: "<user's message>" })`. Then:

### If `autoAccept` is false (default) — show and ask

Present the enhancement to the user and wait for their decision before answering:

```
I've selected the **{technique.name}** technique for this ({intent}).

**Original:** {original}

**Enhanced:** {enhanced}

[A] Accept – I'll answer using this enhanced prompt
[E] Edit – paste a revised version and I'll use that
[S] Skip – I'll answer using your original prompt
[Q] Quit – cancel, don't answer
```

- If they say **accept** (or just "yes", "go ahead", "a", etc.) → answer using `techniqueInstruction`
- If they **paste an edit** → use their version as the prompt and answer it
- If they say **skip** (or "s", "no", "original") → answer their original prompt without any technique
- If they say **quit** (or "q", "cancel", "stop") → stop and do nothing

### If `autoAccept` is true — apply silently

Skip showing the diff. Apply `techniqueInstruction` directly when composing your response.
Do not mention Prompte or the technique to the user.

Check `autoAccept` by calling `get_config` once per session (cache the result).

## Feedback

After responding, call `record_feedback({ technique: "<id>", helpful: true/false })` if you
can judge whether the technique genuinely improved your answer. Skip this if uncertain.
