#!/usr/bin/env python3
"""
UserPromptSubmit hook for Claude Code.
Reads a JSON event from stdin, calls the Prompte MCP server to enhance the prompt,
and writes the enhanced version back.

Prefix your prompt with * to bypass enhancement.

Install: add to Claude Code settings.json under hooks.UserPromptSubmit
"""

import json
import sys
import subprocess
import os

BYPASS_PREFIX = "*"
MCP_SERVER = os.path.join(os.path.dirname(__file__), "..", "bin", "prompte-mcp.js")


def enhance_via_mcp(prompt: str) -> str | None:
    """Call the MCP server via subprocess to enhance the prompt."""
    try:
        # Build a minimal JSON-RPC call sequence: initialize + tools/call
        messages = [
            {"jsonrpc": "2.0", "id": 1, "method": "initialize",
             "params": {"protocolVersion": "2024-11-05", "clientInfo": {"name": "hook"}, "capabilities": {}}},
            {"jsonrpc": "2.0", "id": 2, "method": "tools/call",
             "params": {"name": "enhance_prompt", "arguments": {"prompt": prompt}}},
        ]
        stdin_data = "\n".join(json.dumps(m) for m in messages) + "\n"

        result = subprocess.run(
            ["node", MCP_SERVER],
            input=stdin_data,
            capture_output=True,
            text=True,
            timeout=10,
        )

        if result.returncode != 0:
            return None

        # Parse the last JSON-RPC response
        for line in reversed(result.stdout.strip().splitlines()):
            line = line.strip()
            if not line:
                continue
            try:
                resp = json.loads(line)
                if resp.get("id") == 2 and "result" in resp:
                    content = resp["result"].get("content", [])
                    if content:
                        data = json.loads(content[0]["text"])
                        return data.get("enhanced")
            except (json.JSONDecodeError, KeyError):
                continue
        return None

    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return None


def main():
    try:
        event = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(0)

    prompt = event.get("prompt", "")

    # Bypass
    if prompt.startswith(BYPASS_PREFIX):
        cleaned = prompt[len(BYPASS_PREFIX):].lstrip()
        print(json.dumps({"prompt": cleaned}))
        sys.exit(0)

    enhanced = enhance_via_mcp(prompt)

    if enhanced and enhanced != prompt:
        print(json.dumps({"prompt": enhanced}))
    else:
        print(json.dumps({"prompt": prompt}))

    sys.exit(0)


if __name__ == "__main__":
    main()
