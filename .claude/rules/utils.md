---
paths:
  - 'src/**/utils/**/*.ts'
  - 'src/core/**/*.ts'
---

# Utility Function Patterns

## Pure Functions Only

All utility functions MUST be pure:

- No side effects
- Same input always produces same output
- No external state dependencies

```typescript
// Good: Pure function
export const formatDate = (date: Date, format: string): string => {
  // Transform input to output deterministically
};

// Bad: Side effect
export const formatDate = (date: Date): string => {
  console.log('Formatting date'); // Side effect!
  // ...
};
```

## Function Signature Guidelines

### Explicit Input/Output Types

```typescript
// Good: Clear types
export const parseQuery = (query: string): ParsedQuery => {
  // ...
};

// Bad: Implicit any
export const parseQuery = (query) => {
  // ...
};
```

## Composition Pattern

Design utils for composition:

```typescript
// Small, focused functions
export const trim = (s: string): string => s.trim();
export const lowercase = (s: string): string => s.toLowerCase();
export const normalize = (s: string): string => s.normalize('NFC');

// Compose for complex operations
export const normalizeInput = (input: string): string => normalize(lowercase(trim(input)));
```

## Testing Utilities

Test all edge cases:

```typescript
describe('formatDate', () => {
  it('should format valid date', () => {
    const date = new Date('2024-01-15T10:30:00Z');
    expect(formatDate(date, 'YYYY-MM-DD')).toBe('2024-01-15');
  });

  it('should handle edge cases', () => {
    // Test boundary dates, etc.
  });
});
```
