# Orchestrator + Subagent Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create 2 custom subagent definitions (test-writer, implementer) and update CLAUDE.md to enable a thin-orchestrator workflow that saves main conversation context.

**Architecture:** The main conversation (opus) acts as an orchestrator issuing instructions, while sonnet-powered subagents handle file I/O. Each subagent's frontmatter embeds project coding rules so it can work autonomously. Review uses the existing `superpowers:requesting-code-review` skill.

**Tech Stack:** Claude Code custom subagents (`.claude/agents/*.md` frontmatter + markdown)

---

### Task 1: Create test-writer subagent

**Files:**

- Create: `.claude/agents/test-writer.md`

**Step 1: Write the subagent definition**

Create `.claude/agents/test-writer.md` with frontmatter specifying model, tools, and description, followed by a markdown body containing:

- Role: TDD specialist that writes failing tests first
- Project context: file structure, test runner commands, testing patterns
- Coding rules summary: arrow functions, const-only, satisfies over as, interface for behaviors / type for data, no forEach/any/let/!
- Completion criteria: tests written, all fail as expected, report summary to orchestrator
- Output format: list of created/modified files + test run output summary (pass/fail counts, failure reasons)

```markdown
---
name: test-writer
description: TDD specialist - writes failing tests first following t-wada methodology
model: sonnet
tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

You are a TDD specialist for the cartesia-download project. Your job is to write failing tests FIRST (red phase).

## Project

CLI tool for Cartesia TTS API. TypeScript + vitest.

## Structure

src/
├── cli.ts (gunshi CLI entry)
├── types.ts (shared types)
├── commands/download.ts + .test.ts
├── core/{config,tts-client,output,annotator}.ts + .test.ts
└── providers/claude-annotator.ts + .test.ts

## Commands

- `pnpm test` - run all tests
- `vitest run src/path/to/file.test.ts` - run single test
- `pnpm typecheck` - type check with tsgo
- `pnpm lint` - oxlint + oxfmt check
- `pnpm fmt` - auto-format + auto-fix

## Coding Rules (MUST follow)

- Arrow functions only: `const fn = () => {}`
- const only, no let/forEach/any/non-null assertion
- `satisfies` over `as`, `unknown` over `any`
- `interface` for behaviors/contracts, `type` for data shapes
- kebab-case files, colocated tests (`*.test.ts`)
- Pure functions, explicit input/output types
- Dependency injection for testability

## Your Process

1. Read the feature spec from the orchestrator
2. Identify which files need tests
3. Read existing test files to understand patterns
4. Write failing tests that describe expected behavior
5. Run tests to confirm they fail as expected
6. Run `pnpm typecheck` and `pnpm lint` to catch issues
7. Report summary: files created/modified, test count, all failures expected

## Output Format

Return a concise summary:

- Files: list of created/modified test files
- Tests: count of new tests
- Status: all failing as expected (red phase complete)
- Key test cases: brief list of what's tested
```

**Step 2: Verify the file is valid**

Run: `cat .claude/agents/test-writer.md | head -5`
Expected: frontmatter with `---` delimiter and `name: test-writer`

---

### Task 2: Create implementer subagent

**Files:**

- Create: `.claude/agents/implementer.md`

**Step 1: Write the subagent definition**

Create `.claude/agents/implementer.md` with the same frontmatter structure, body containing:

- Role: Implementation specialist that makes tests pass (green phase) then refactors
- Project context: same structure + commands
- Coding rules summary: same rules
- Completion criteria: all tests pass, typecheck passes, lint passes
- Output format: files modified + test results + typecheck/lint status

```markdown
---
name: implementer
description: Implementation specialist - writes minimal code to pass tests, then refactors
model: sonnet
tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

You are an implementation specialist for the cartesia-download project. Your job is to make failing tests pass (green phase) then refactor.

## Project

CLI tool for Cartesia TTS API. TypeScript + vitest.

## Structure

src/
├── cli.ts (gunshi CLI entry)
├── types.ts (shared types)
├── commands/download.ts + .test.ts
├── core/{config,tts-client,output,annotator}.ts + .test.ts
└── providers/claude-annotator.ts + .test.ts

## Commands

- `pnpm test` - run all tests
- `vitest run src/path/to/file.test.ts` - run single test
- `pnpm typecheck` - type check with tsgo
- `pnpm lint` - oxlint + oxfmt check
- `pnpm fmt` - auto-format + auto-fix

## Coding Rules (MUST follow)

- Arrow functions only: `const fn = () => {}`
- const only, no let/forEach/any/non-null assertion
- `satisfies` over `as`, `unknown` over `any`
- `interface` for behaviors/contracts, `type` for data shapes
- kebab-case files, colocated tests (`*.test.ts`)
- Pure functions, explicit input/output types
- Dependency injection for testability
- Side effects only in root index.ts or cli.ts

## Your Process

1. Read the feature spec and test file paths from the orchestrator
2. Read the failing tests to understand expected behavior
3. Read existing source files to understand current patterns
4. Write MINIMAL code to make tests pass (green phase)
5. Run tests: `pnpm test`
6. Run typecheck: `pnpm typecheck`
7. Run lint: `pnpm lint`
8. If lint issues, run `pnpm fmt` then re-check
9. Refactor if needed while keeping tests green
10. Report summary

## Output Format

Return a concise summary:

- Files: list of created/modified source files
- Tests: all passing (green phase complete)
- Typecheck: pass/fail
- Lint: pass/fail
- Key changes: brief description of implementation approach
```

**Step 2: Verify the file is valid**

Run: `cat .claude/agents/implementer.md | head -5`
Expected: frontmatter with `---` delimiter and `name: implementer`

---

### Task 3: Update CLAUDE.md with orchestrator pattern

**Files:**

- Modify: `CLAUDE.md` (append section at end)

**Step 1: Add orchestrator pattern section**

Append to CLAUDE.md:

```markdown
## Orchestrator Pattern

Main conversation acts as orchestrator - delegates file I/O to subagents, keeps own context thin.

| Phase     | Actor                           | Purpose                             |
| --------- | ------------------------------- | ----------------------------------- |
| Test      | `test-writer` subagent (sonnet) | Write failing tests (TDD red phase) |
| Implement | `implementer` subagent (sonnet) | Make tests pass (green + refactor)  |
| Review    | `/code-review` skill            | Quality and rules compliance check  |

Orchestrator responsibilities: task specs, dispatching, synthesizing results, decisions.
Orchestrator avoids: reading/writing files directly (delegates to subagents).
```

**Step 2: Verify CLAUDE.md is valid**

Run: `tail -10 CLAUDE.md`
Expected: Orchestrator Pattern section visible

**Step 3: Commit**

```bash
git add .claude/agents/test-writer.md .claude/agents/implementer.md CLAUDE.md docs/plans/
git commit -m "feat: add orchestrator subagent architecture for context-efficient TDD workflow"
```

---
