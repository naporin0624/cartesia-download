# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Commands

```bash
# Development
pnpm dev              # Run CLI with tsx (pass args after --)

# Build
pnpm build            # Build with tsdown (output: dist/)

# Type checking
pnpm typecheck        # Run tsgo (TypeScript native preview) --noEmit

# Testing
pnpm test             # Run vitest once
pnpm test:watch       # Run vitest in watch mode
vitest run src/path/to/file.test.ts  # Run single test file

# Linting & Formatting
pnpm lint             # Check: oxlint + oxfmt --check
pnpm fmt              # Fix: oxfmt --write + oxlint --fix
```

## Architecture

CLI tool for downloading audio from Cartesia TTS API with optional LLM-based emotion annotation.

### Project Structure

```
src/
├── cli.ts                          # CLI entry point (gunshi)
├── types.ts                        # Shared type definitions
├── commands/
│   ├── download.ts                 # Download command implementation
│   └── download.test.ts
├── core/
│   ├── config.ts                   # Configuration resolution
│   ├── config.test.ts
│   ├── tts-client.ts               # Cartesia TTS API client
│   ├── tts-client.test.ts
│   ├── output.ts                   # File output handling
│   ├── output.test.ts
│   ├── annotator.ts                # Annotator factory
│   └── annotator.test.ts
└── providers/
    ├── claude-annotator.ts         # Claude-based emotion annotation
    └── claude-annotator.test.ts
```

### Key Dependencies

- **gunshi**: CLI framework
- **@cartesia/cartesia-js**: Cartesia TTS API client
- **ai** + **@ai-sdk/anthropic**: Vercel AI SDK for LLM emotion annotation
- **vitest**: Test runner

### Toolchain

- **TypeScript**: `typescript` for IDE + `@typescript/native-preview` (tsgo) for fast typechecking
- **oxlint**: Linting (with typescript, import, unicorn, promise, node plugins)
- **oxfmt**: Formatting (printWidth: 200, singleQuote, semi, trailingComma: all)
- **tsdown**: Build tool (ESM, Node 18 target)
- **husky** + **lint-staged**: Pre-commit hooks (typecheck + lint staged files)

## Coding Rules

All coding rules are defined in `.claude/rules/` and auto-loaded by paths filter.

| File                   | Content                                                |
| ---------------------- | ------------------------------------------------------ |
| `arrow-functions.md`   | Arrow function syntax only (no function declarations)  |
| `immutable.md`         | const only, no forEach/any, functional patterns        |
| `typescript.md`        | satisfies over as, interface vs type, unknown over any |
| `design-principles.md` | TDD (t-wada), OCP, testability first                   |
| `naming.md`            | kebab-case files, namespace convention                 |
| `utils.md`             | Pure functions, explicit types, composition            |
| `side-effects.md`      | Global side effects in root files only                 |

## Configuration

### Environment Variables

- `CARTESIA_API_KEY` - Cartesia TTS API key
- `ANTHROPIC_API_KEY` - Anthropic API key (for emotion annotation)

### RC File (`.cartesiarc.json`)

```json
{
  "apiKey": "...",
  "modelId": "sonic-2",
  "voiceId": "...",
  "language": "ja",
  "outputFormat": "wav"
}
```

## Orchestrator Pattern

Main conversation acts as orchestrator - delegates file I/O to subagents, keeps own context thin.

| Phase     | Actor                           | Purpose                             |
| --------- | ------------------------------- | ----------------------------------- |
| Test      | `test-writer` subagent (sonnet) | Write failing tests (TDD red phase) |
| Implement | `implementer` subagent (sonnet) | Make tests pass (green + refactor)  |
| Review    | `/code-review` skill            | Quality and rules compliance check  |

Orchestrator dispatches subagents with: feature spec (what to build), target file paths, relevant context.
Orchestrator synthesizes: subagent summaries into decisions. Avoids reading/writing files directly.
