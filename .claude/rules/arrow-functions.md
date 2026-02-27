---
paths:
  - 'src/**/*.ts'
---

# Arrow Functions Only

All functions must use arrow function syntax (`const fn = () => {}`). The `func-style` rule enforces this.

## Required Pattern

```typescript
// Correct - arrow function
export const calculateTotal = (items: Item[]): number => {
  return items.reduce((sum, item) => sum + item.price, 0);
};
```

## Forbidden Pattern

```typescript
// Wrong - function declaration
export function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// Wrong - function expression with function keyword
export const calculateTotal = function (items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
};
```

## Exception: TypeScript Function Overloads

TypeScript function overloads require `function` declarations. Use `eslint-disable` comments:

```typescript
// eslint-disable-next-line func-style -- overloads require function declaration
export function overloadedFn(a: string): string;
export function overloadedFn(a: number): number;
export function overloadedFn(a: string | number): string | number {
  return a;
}
```
