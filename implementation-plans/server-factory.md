# Implementation Plan: Server Factory Improvements

## 1. Remove automatic default player creation

### Remove the automatic default player creation logic

```typescript
// In packages/remote-state/src/core/server.ts
// Before:
} else {
  // Create a default player if no token is provided
  const defaultPlayerId = `player-${Date.now()}`;
  player = await addPlayerToGame({
    id: defaultPlayerId,
    gameId,
    name: 'Default Player',
    role: 'player',
  });
}

// After:
} else {
  // Return error if no token is provided
  return res.status(401).json({
    error: 'Authentication required',
    code: 'MISSING_AUTHENTICATION',
    timestamp: new Date().toISOString()
  });
}
```

## 2. Separate concerns by moving game logic validation to a dedicated module

### Create a dedicated validation module

```typescript
// In packages/remote-state/src/game-engine/validator.ts
import { GameValidationResult } from "../core/types";

export const validateGameAction = <StateType, ActionType>(
  state: StateType,
  action: ActionType,
  gameRules: {
    validateAction: (
      state: StateType,
      action: ActionType
    ) => GameValidationResult;
  }
): GameValidationResult => {
  return gameRules.validateAction(state, action);
};
```

### Update the server factory to use the dedicated module

```typescript
// In packages/remote-state/src/core/server.ts
import { validateGameAction } from "../game-engine/validator";

// In the action submission endpoint:
const validationResult = validateGameAction(
  currentState as StateType,
  action as ActionType,
  config // Pass the game configuration which contains validation rules
);
```

## 3. Add player session management with timeout handling

### Add session management to the Player model

```typescript
// In packages/remote-state/src/database/models/Player.ts
@Column({
  type: DataType.DATE,
  allowNull: true,
})
declare lastActivityAt: Date | null;

// Add a method to check if player session is still valid
isSessionValid(timeoutMinutes: number = 30): boolean {
  if (!this.lastActivityAt) return false;
  const timeoutMs = timeoutMinutes * 60 * 1000;
  return (Date.now() - this.lastActivityAt.getTime()) < timeoutMs;
}
```

### Update player activity tracking in the server

```typescript
// In packages/remote-state/src/core/server.ts
// Update player's last activity when they perform an action
await Player.update(
  { lastActivityAt: new Date() },
  { where: { id: player.id } }
);
```

## 4. Implement proper CORS configuration

### Remove duplicate CORS configuration

```typescript
// In packages/remote-state/src/core/server.ts
// Remove the manual CORS headers in the middleware:
/*
res.header('Access-Control-Allow-Origin', '*');
res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
res.header(
  'Access-Control-Allow-Headers',
  'Origin, X-Requested-With, Content-Type, Accept, Authorization'
);
*/

// Keep only the cors middleware:
app.use(cors());
```

## 5. Add rate limiting to prevent abuse

### Add rate limiting middleware

```typescript
// In packages/remote-state/src/core/middleware/rateLimiter.ts
import rateLimit from "express-rate-limit";

export const actionRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests",
    code: "RATE_LIMIT_EXCEEDED",
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 authentication requests per windowMs
  message: {
    error: "Too many authentication attempts",
    code: "AUTH_RATE_LIMIT_EXCEEDED",
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
});
```

### Apply rate limiting to routes

```typescript
// In packages/remote-state/src/core/server.ts
import { actionRateLimiter, authRateLimiter } from "./middleware/rateLimiter";

// Apply to action submission endpoint
app.post(
  "/api/games/:gameId/actions",
  actionRateLimiter,
  async (req: Request, res: Response) => {
    // ...
  }
);

// Apply to authentication endpoints
app.post(
  "/api/auth/register/owner",
  authRateLimiter,
  async (req: Request, res: Response) => {
    // ...
  }
);

app.post(
  "/api/auth/register/join",
  authRateLimiter,
  async (req: Request, res: Response) => {
    // ...
  }
);
```

## 6. Implement graceful shutdown handling

### Add graceful shutdown handling

```typescript
// In packages/remote-state/src/core/server.ts
export const createRemoteStateServer = async <StateType, ActionType>(
  config: RemoteStateServerConfig<StateType, ActionType>,
  port: number = 3000
): Promise<RemoteStateServer> => {
  // ... existing code ...

  // Graceful shutdown handling
  const shutdown = async () => {
    info("Shutting down server...");
    try {
      // Close database connections
      await closeDatabase();
      // Close HTTP server
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
      info("Server shut down successfully");
      process.exit(0);
    } catch (error) {
      error("Error during shutdown:", error);
      process.exit(1);
    }
  };

  // Listen for shutdown signals
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  return {
    app,
    server,
    startServer,
    port,
    shutdown, // Export shutdown function
  };
};
```
