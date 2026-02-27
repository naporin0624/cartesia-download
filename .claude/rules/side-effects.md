---
paths:
  - 'src/*/index.ts'
  - 'src/cli.ts'
---

# Global Side Effects Rule

All global side effects MUST be placed in the root `index.ts` file of each module or in `cli.ts`.

## What Are Global Side Effects?

- Extending libraries with plugins
- Setting global defaults
- Global state initialization

## Correct Pattern

```typescript
// src/cli.ts - entry point
// Global side effects - ONLY allowed here
```

## Forbidden Pattern

```typescript
// src/core/config.ts
// NEVER do side effects in non-root files!
```

## Why This Matters

1. **Predictability**: Side effects in root files are executed once at import time
2. **Order Control**: Root files are imported first, ensuring proper initialization order
3. **Debugging**: Easy to find all global setup in one place
4. **Testing**: Easier to mock/override global state for tests
