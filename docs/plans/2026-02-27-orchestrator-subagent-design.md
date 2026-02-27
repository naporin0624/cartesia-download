# Orchestrator + Subagent Architecture Design

## Goal

Context window savings by keeping the main conversation (orchestrator) thin and delegating heavy implementation work to subagents.

## Architecture

```
Orchestrator (opus) ── instructions, decisions, synthesis only
  ├─ test-writer (sonnet)   ── TDD: write failing tests first
  ├─ implementer (sonnet)   ── write code to pass tests
  └─ /code-review skill     ── quality review (existing superpowers skill)
```

## Orchestrator Responsibilities

- Receive user requirements and create task specifications
- Dispatch subagents with specs + file paths
- Synthesize subagent summary results
- Make decisions and coordinate phases
- **Never read/write files directly** (core context savings principle)

## Subagent Definitions

### test-writer (.claude/agents/test-writer.md)

- **Input**: Feature spec (text), target file paths
- **Output**: Test files created + test run result summary
- **Tools**: Read, Write, Edit, Bash, Glob, Grep
- **Model**: sonnet
- **Completion criteria**: Tests written, all fail as expected (red phase)

### implementer (.claude/agents/implementer.md)

- **Input**: Feature spec + test file paths
- **Output**: Implementation code + test pass results
- **Tools**: Read, Write, Edit, Bash, Glob, Grep
- **Model**: sonnet
- **Completion criteria**: All tests pass, typecheck passes, lint passes

### Review (existing skill)

- Uses `superpowers:requesting-code-review` skill
- No custom subagent needed

## Workflow

1. User describes feature/fix
2. Orchestrator writes task spec
3. Orchestrator dispatches `test-writer` with spec
4. Orchestrator dispatches `implementer` with spec + test paths
5. Orchestrator invokes `/code-review` skill
6. Orchestrator synthesizes results and reports to user

## CLAUDE.md Changes

Add `## Orchestrator Pattern` section describing the delegation strategy.

## Context Savings Estimate

| Actor        | Context usage                              |
| ------------ | ------------------------------------------ |
| Orchestrator | ~2-3k tokens/iteration (summaries only)    |
| test-writer  | ~5-10k tokens (isolated, discarded after)  |
| implementer  | ~10-15k tokens (isolated, discarded after) |
| Review skill | ~3-5k tokens (isolated)                    |

vs. single conversation: 20-30k tokens all in one window.
