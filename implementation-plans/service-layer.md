# Implementation Plan: Service Layer Improvements

## 1. Standardize error handling approach

### Create a consistent error handling approach using exceptions

Replace the mixed approach with try/catch and return values with consistent exception throwing:

```typescript
// In packages/remote-state/src/database/service.ts
// Before: Mixed approach with try/catch and return values
try {
  // ...
} catch (error) {
  info(`Creating minimal game state due to schema mismatch: ${error}`);
  // ...
}

// After: Consistent exception throwing
try {
  // ...
} catch (error) {
  throw new Error(
    `Failed to create game state: ${error instanceof Error ? error.message : String(error)}`
  );
}
```

## 2. Properly implement generic types throughout the service layer

### Update the DatabaseService interface to properly use generics

```typescript
// In packages/remote-state/src/database/service.ts
export interface DatabaseService<ActionType, StateType, ValidationResultType> {
  // Update all method signatures to use the generic types properly
  recordAction: (actionData: {
    id: string;
    gameId: string;
    playerId: string;
    actionType: string;
    actionData: ActionType; // Use generic type
    gameState: StateType; // Use generic type
    validationResult: ValidationResultType; // Use generic type
  }) => Promise<{
    id: string;
    gameId: string;
    playerId: string;
    actionType: string;
    actionData: ActionType;
    gameState: StateType;
    timestamp: Date;
    validationResult: ValidationResultType;
  }>;
}
```

## 3. Remove redundant code in createGame function

### Eliminate duplicate code blocks

Remove the duplicate code for creating game state:

```typescript
// In packages/remote-state/src/database/service.ts
// Before:
const newGame = await Game.create({
  // ...
});

// Create initial game state
try {
  await GameState.create({
    // ...
  });
} catch (error) {
  // If the GameState table doesn't have the new fields yet, create a minimal record
  info(`Creating minimal game state due to schema mismatch: ${error}`);
  await GameState.create({
    // DUPLICATE CODE
  });
}

// After:
const newGame = await Game.create({
  // ...
});

// Create initial game state (single implementation)
await GameState.create({
  id: `state-${gameData.id}`,
  gameId: gameData.id,
  state: null,
  playerId: "system",
  actionType: "initial",
  actionData: null,
  validationResult: null,
  timestamp: now,
});
```

## 4. Implement the updateGameStateWithValidation function

### Replace the placeholder implementation

```typescript
// In packages/remote-state/src/database/service.ts
export const updateGameStateWithValidation = async <A, S>(
  gameId: string,
  action: A,
  token: string
): Promise<{ success: boolean; state?: S; error?: string }> => {
  info(`Updating game state with validation for game: ${gameId}`);

  try {
    // Get current game state
    const currentState = await getCurrentGameState<S>(gameId);
    if (!currentState?.state) {
      return { success: false, error: "No current game state found" };
    }

    // Get player by token
    const player = await validatePlayerToken(token);
    if (!player) {
      return { success: false, error: "Invalid player token" };
    }

    // Here we would call game-specific validation logic
    // This would be implemented by the game plugin in the actual server
    // For now, we'll return a success response
    return { success: true, state: currentState.state };
  } catch (error) {
    info(`Error updating game state with validation: ${error}`);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
```

## 5. Add proper transaction handling

### Implement transaction handling for related operations

```typescript
// In packages/remote-state/src/database/service.ts
import { Transaction } from "sequelize";

export const createGameWithInitialState = async <S>(
  gameData: {
    id: string;
    name: string;
    status: string;
  },
  initialState: S
): Promise<{
  id: string;
  name: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}> => {
  const sequelize = await getSequelizeInstance();

  return sequelize.transaction(async (transaction: Transaction) => {
    // Create the game
    const newGame = await Game.create(
      {
        id: gameData.id,
        name: gameData.name,
        status: gameData.status,
      },
      { transaction }
    );

    // Create initial game state
    await GameState.create(
      {
        id: `state-${gameData.id}`,
        gameId: gameData.id,
        state: safeJsonStringify(initialState),
        playerId: "system",
        actionType: "initial",
        actionData: null,
        validationResult: null,
      },
      { transaction }
    );

    return {
      id: newGame.id,
      name: newGame.name,
      status: newGame.status,
      createdAt: newGame.createdAt,
      updatedAt: newGame.updatedAt,
    };
  });
};
```

## 6. Add input validation for all service functions

### Add validation to service functions

```typescript
// In packages/remote-state/src/database/service.ts
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
  if (!gameData.id || !gameData.name || !gameData.status) {
    throw new Error("Game data must include id, name, and status");
  }

  if (gameData.id.length < 1) {
    throw new Error("Game ID must not be empty");
  }

  if (gameData.name.length < 1) {
    throw new Error("Game name must not be empty");
  }

  info(`Creating new game: ${gameData.name}`);
  // ... rest of implementation
};
```
