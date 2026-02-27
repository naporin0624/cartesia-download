---
paths:
  - 'src/**/*'
---

# File and Directory Naming Conventions

## Kebab-Case Everywhere

All files and directories use kebab-case:

```
src/
├── core/
│   ├── config.ts
│   ├── tts-client.ts
│   └── output.ts
├── commands/
│   └── download.ts
├── providers/
│   └── claude-annotator.ts
└── cli.ts
```

## Namespace Convention

When a directory provides namespace context, child files should NOT repeat that namespace:

```
# Correct
core/
├── config.ts
├── tts-client.ts
└── output.ts

# Incorrect
core/
├── core-config.ts
├── core-tts-client.ts
└── core-output.ts
```

## Module Structure

```
module-name/
├── index.ts               # Module implementation & exports
└── module-name.test.ts    # Module tests
```

## Test File Naming

- Unit tests: `<module-name>.test.ts`
- Colocate tests with the code they test

## Index Files

Use `index.ts` for:

- Main exports of a directory
- Barrel exports (re-exporting from multiple files)
