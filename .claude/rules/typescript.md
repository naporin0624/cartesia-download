---
paths:
  - 'src/**/*.ts'
---

# TypeScript Type Safety Rules

## Type Assertions

### Always Use `satisfies` Over `as`

```typescript
// Correct - type checking with satisfies
const config = {
  port: 3000,
  host: 'localhost',
} satisfies ServerConfig;

// Incorrect - as bypasses type checking
const config = {
  port: 3000,
  host: 'localhost',
} as ServerConfig;
```

### Use `unknown` Over `any`

```typescript
// Correct - forces type narrowing
const parseJson = (input: string): unknown => JSON.parse(input);

// Then narrow with type guards
const isUser = (value: unknown): value is User => {
  return typeof value === 'object' && value !== null && 'id' in value && 'name' in value;
};

// Incorrect - loses all type safety
const parseJson = (input: string): any => JSON.parse(input);
```

## Interface vs Type Philosophy

### Use `interface` for Behaviors and Contracts

Interfaces define **what something can do** - function signatures, class contracts, API definitions:

```typescript
interface UserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

interface Comparator<T> {
  (a: T, b: T): number;
}
```

### Use `type` for Data Structures

Types define **what something is** - data shapes, unions, computed types:

```typescript
type User = {
  id: string;
  name: string;
  email: string;
};

type EventType = 'create' | 'update' | 'delete';
type UserKeys = keyof User;
```

## Type Guards

```typescript
const isString = (value: unknown): value is string => {
  return typeof value === 'string';
};
```

## Strict Null Checks

```typescript
// Use optional chaining
const name = user?.profile?.displayName;

// Use nullish coalescing
const displayName = user?.name ?? 'Anonymous';
```
