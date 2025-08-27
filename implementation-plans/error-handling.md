# Implementation Plan: Error Handling Improvements

## 1. Standardize error response format

### Create a standardized error response interface

```typescript
// In packages/remote-state/src/types.ts
export interface ErrorResponse {
  error: string;
  code: string;
  details?: Record<string, unknown>;
  timestamp: string;
}
```

### Update all error responses to use the standardized format

```typescript
// In packages/remote-state/src/server-factory.ts
// Before:
return res.status(400).json({ error: "Action is required" });

// After:
return res.status(400).json({
  error: "Action is required",
  code: "MISSING_ACTION",
  timestamp: new Date().toISOString(),
});
```

## 2. Add more context to error messages

### Include relevant IDs and context in error messages

```typescript
// Before:
error("Error processing action:", {
  error: err instanceof Error ? err.message : String(err),
});

// After:
error("Error processing action:", {
  error: err instanceof Error ? err.message : String(err),
  gameId,
  actionType: action?.type,
  playerId: player?.id,
  timestamp: new Date().toISOString(),
});
```

## 3. Implement centralized error handling middleware

### Create error handling middleware

```typescript
// In packages/remote-state/src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from "express";
import { createLogger } from "../logger";

const { error: logError } = createLogger({ scope: "error-handler" });

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logError("Unhandled error:", {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  // Return standardized error response
  res.status(500).json({
    error: "Internal server error",
    code: "INTERNAL_ERROR",
    timestamp: new Date().toISOString(),
  });
};
```

### Register the middleware in the server factory

```typescript
// In packages/remote-state/src/server-factory.ts
import { errorHandler } from "./middleware/errorHandler";

// After all routes:
app.use(errorHandler);
```

## 4. Add error logging with appropriate log levels

### Update all error logging to include appropriate context

```typescript
// In packages/remote-state/src/db/service.ts
// Before:
info(`Error updating game state with validation: ${error}`);

// After:
error("Error updating game state with validation:", {
  error: error instanceof Error ? error.message : String(error),
  gameId,
  stack: error instanceof Error ? error.stack : undefined,
  timestamp: new Date().toISOString(),
});
```

## 5. Implement custom error classes

### Create custom error classes for different error types

```typescript
// In packages/remote-state/src/errors.ts
export class ValidationError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class AuthorizationError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class GameLogicError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = "GameLogicError";
  }
}
```

### Update error handling to use custom error classes

```typescript
// In packages/remote-state/src/server-factory.ts
import { ValidationError, AuthorizationError } from "./errors";

// In action validation:
if (!validationResult.valid) {
  throw new ValidationError(
    validationResult.error || "Invalid action",
    validationResult.code || "INVALID_ACTION"
  );
}

// In token validation:
if (!player) {
  throw new AuthorizationError("Invalid or expired token", "INVALID_TOKEN");
}
```
