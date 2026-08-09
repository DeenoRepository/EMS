# Rules for Subagents and Model Usage

- Main Agent Model: Always use `claude-fable-5` (or `fable`).
- Subagents & Background Tasks: Must strictly invoke `claude-3-5-haiku-20241022` (or `haiku`).
- Subagent Concurrency: Avoid launching multiple subagents concurrently to prevent 429 quota bursts on local proxy. Run subtasks sequentially.
- Token Economy: Keep subagent prompts and outputs minimal, concise, and focused.
