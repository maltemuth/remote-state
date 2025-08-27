# Implementation Plan: Code Organization Improvements

## 1. Separate concerns into distinct modules

### Create a new directory structure for better organization

```
packages/remote-state/src/
├── core/                 # Core functionality
│   ├── server.ts         # HTTP server setup
│   ├── middleware/       # Express middleware
│   └── types.ts          # Shared types
├── database/             # Database layer
│   ├── models/           # Sequelize models
│   ├── service.ts        # Database service
│   └── instance.ts       # Database initialization
├── game-engine/          # Game logic
│   ├── validator.ts      # Action validation
│   └── executor.ts       # Action execution
├── auth/                 # Authentication and authorization
│   └── service.ts        # Auth service
└── utils/                # Utility functions
    ├── logger.ts         # Logging utility
    └── json.ts           # JSON utilities
```

### Move files to their appropriate directories

```bash
# Create new directories
mkdir -p src/core/middleware src/database src/game-engine src/auth src/utils

# Move files
mv src/server-factory.ts src/core/server.ts
mv src/logger.ts src/utils/logger.ts
mv src/db/* src/database/
mv src/server.ts src/core/server-example.ts  # Keep as example
```

## 2. Organize files by feature rather than by type

### Group game-related functionality together

```
packages/remote-state-example-server/src/games/tic-tac-toe/
├── engine.ts             # Game logic
├── types.ts              # Game-specific types
├── validator.ts          # Game-specific validation
└── executor.ts           # Game-specific execution
```

## 3. Create a shared utilities module

### Create a shared JSON utility module

```typescript
// In packages/remote-state/src/utils/json.ts
export const safeJsonParse = <T>(
  jsonString: string | null | undefined
): T | null => {
  if (!jsonString) return null;
  try {
    return JSON.parse(jsonString) as T;
  } catch (_error) {
    return null;
  }
};

export const safeJsonStringify = (obj: unknown): string | null => {
  if (obj === null || obj === undefined) return null;
  try {
    return JSON.stringify(obj);
  } catch (_error) {
    return null;
  }
};
```

### Update imports to use the shared utility

```typescript
// In packages/remote-state/src/database/service.ts
import { safeJsonParse, safeJsonStringify } from "../utils/json";
```

## 4. Implement a plugin system for game-specific logic

### Create a game plugin interface

```typescript
// In packages/remote-state/src/core/types.ts
export interface GamePlugin<StateType, ActionType> {
  getInitialState: (gameId: string) => StateType;
  validateAction: (
    state: StateType,
    action: ActionType
  ) => GameValidationResult;
  executeAction: (
    state: StateType,
    action: ActionType & { playerId: string; timestamp: Date }
  ) => GameMoveResult<StateType>;
  gameConfig?: {
    name: string;
    description?: string;
  };
}
```

### Update the server factory to use the plugin interface

```typescript
// In packages/remote-state/src/core/server.ts
import { GamePlugin } from "./types";

export const createRemoteStateServer = async <StateType, ActionType>(
  plugin: GamePlugin<StateType, ActionType>,
  port: number = 3000
): Promise<RemoteStateServer> => {
  // Implementation using the plugin
};
```
