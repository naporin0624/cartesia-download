---
paths:
  - 'src/**/*.ts'
---

# Immutable Programming Rules

This project follows functional programming principles with immutable data patterns.

## Absolutely Forbidden

- **`let` keyword** - Use `const` exclusively
- **Non-null assertion operator (`!`)** - Use proper null checks instead
- **`forEach()` method** - Use `for...of` loops or array methods that return values
- **`any` type** - Use `unknown` for truly unknown data, or define proper types

## Required Patterns

### Variable Declaration

```typescript
// Always use const
const value = condition ? calculateValue() : undefined;

// Never reassign - create new values instead
const updatedArray = [...originalArray, newItem];
const updatedObject = { ...original, property: newValue };
```

### Loop Implementation

```typescript
// Standard iteration
for (const item of array) {
  console.log(item);
}

// When index is needed
for (const [index, item] of array.entries()) {
  console.log(index, item);
}

// Transformation (prefer map/filter/reduce)
const doubled = array.map((x) => x * 2);
const evens = array.filter((x) => x % 2 === 0);
const sum = array.reduce((acc, x) => acc + x, 0);
```

## Functional Composition

```typescript
// y = f(x) pattern
const processData = (input: RawData): ProcessedData => transform(input);

// z = g(f(x)) pattern - compose transformations
const result = finalTransform(intermediateTransform(input));
```

## Pure Functions

- Functions should have no side effects
- Same input always produces same output
- Side effects should be isolated to the edges of the system
