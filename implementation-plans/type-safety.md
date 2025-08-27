# Implementation Plan: Type Safety Improvements

## 1. Replace `any` and `unknown` with specific types

### Identify all instances of `any` and `unknown` in the codebase

In `packages/remote-state/src/db/service.ts`, the `safeJsonParse` function uses `ExpectedType = unknown`
In `packages/remote-state/src/server-factory.ts`, several places use generic types without proper constraints

### Create specific interfaces for action and state objects

```typescript
// In a new file: packages/remote-state/src/types.ts
export interface BaseAction {
  type: string;
  playerId: string;
  timestamp: Date;
}

export interface BaseState {
  createdAt: Date;
  updatedAt: Date;
}
```

### Update the `safeJsonParse` function with proper generics

```typescript
// Before:
const safeJsonParse = <ExpectedType = unknown>(
  jsonString: string | null | undefined
): ExpectedType => {
  // ...
};

// After:
const safeJsonParse = <T>(jsonString: string | null | undefined): T | null => {
  if (!jsonString) return null;
  try {
    return JSON.parse(jsonString) as T;
  } catch (_error) {
    return null;
  }
};
```

## 2. Use proper optional field handling

### Update the Player model to properly handle optional fields

```typescript
// In packages/remote-state/src/db/models/Player.ts
// Before:
declare token?: string;
declare tokenType?: string;

// After:
declare token: string | null;
declare tokenType: string | null;
```

### Update all functions that use these fields to check for null values

```typescript
// In packages/remote-state/src/db/service.ts
// Before:
token: result.token || undefined,

// After:
token: result.token ?? null,
```

## 3. Add runtime type validation

### Add zod as a dependency

```bash
npm install zod
```

### Create validation schemas for key data structures

```typescript
// In packages/remote-state/src/validation.ts
import { z } from "zod";

export const GameDataSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  status: z.string(),
});

export const PlayerDataSchema = z.object({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
  name: z.string().min(1),
  role: z.enum(["player", "admin"]),
  token: z.string().optional(),
  tokenType: z.enum(["owner", "identity"]).optional(),
});
```

### Add validation to service functions

```typescript
// In packages/remote-state/src/db/service.ts
export const createGame = async (gameData: {
  id: string;
  name: string;
  status: string;
}): Promise<{
  id: string;
  name: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}> => {
  // Validate input
  const validatedData = GameDataSchema.parse(gameData);

  // Rest of the function...
};
```

## 4. Implement stricter TypeScript configuration

### Update tsconfig.json to enable stricter options

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "exactOptionalPropertyTypes": true
  }
}
```

## 5. Use discriminated unions for action types

### Define specific action types using discriminated unions

```typescript
// In packages/remote-state/src/types.ts
export type GameAction =
  | {
      type: "move";
      position: [number, number];
      playerId: string;
      timestamp: Date;
    }
  | { type: "restart"; playerId: string; timestamp: Date }
  | { type: "join"; playerId: string; timestamp: Date }
  | { type: "leave"; playerId: string; timestamp: Date };
```

### Update functions to use the discriminated union

```typescript
// In service functions, replace generic action handling with specific type guards
const isMoveAction = (
  action: GameAction
): action is Extract<GameAction, { type: "move" }> => {
  return action.type === "move";
};
```
