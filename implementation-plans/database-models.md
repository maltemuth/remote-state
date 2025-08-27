# Implementation Plan: Database Model Improvements

## 1. Standardize timestamp usage across all models

### Update the Player model to enable timestamps

Change `timestamps: false` to `timestamps: true` in the Player model:

```typescript
// In packages/remote-state/src/database/models/Player.ts
@Table({
  tableName: "players",
  timestamps: true, // Changed from false to true
})
export class Player extends Model<Player> {
  // Remove the manual @CreatedAt field since we're using timestamps
  // Sequelize will automatically add createdAt and updatedAt fields
}
```

### Update the GameState model to enable timestamps

Change `timestamps: false` to `timestamps: true` in the GameState model:

```typescript
// In packages/remote-state/src/database/models/GameState.ts
@Table({
  tableName: "gameStates",
  timestamps: true, // Changed from false to true
})
export class GameState extends Model<GameState> {
  // Remove the manual @CreatedAt field and use Sequelize's automatic timestamps
}
```

## 2. Consistent field naming conventions

### Update field names to be consistent

Replace custom `timestamp` field with standard `createdAt` and `updatedAt`:

```typescript
// In packages/remote-state/src/database/models/GameState.ts
// Before:
@CreatedAt
@Column({
  type: DataType.DATE,
  allowNull: false,
  field: 'timestamp',
})
declare timestamp: Date;

// After:
@CreatedAt
@Column({
  type: DataType.DATE,
  allowNull: false,
})
declare createdAt: Date;

@UpdatedAt
@Column({
  type: DataType.DATE,
  allowNull: false,
})
declare updatedAt: Date;
```

## 3. Remove unused fields

### Remove the `isJoinable` field from GameState

Remove this entire block from the GameState model:

```typescript
// In packages/remote-state/src/database/models/GameState.ts
// Remove this entire block:
/*
@Column({
  type: DataType.BOOLEAN,
  allowNull: false,
  defaultValue: false,
})
declare isJoinable: boolean;
*/
```

### Update the service layer to remove references to the removed field

```typescript
// In packages/remote-state/src/database/service.ts
// In createGame function, remove isJoinable from GameState creation:
await GameState.create({
  id: `state-${gameData.id}`,
  gameId: gameData.id,
  state: null,
  playerId: "system",
  actionType: "initial",
  actionData: null,
  validationResult: null,
  // Remove: isJoinable: true,
  timestamp: now,
});
```

## 4. Add proper indexes on foreign key fields

### Add indexes to foreign key fields

Add indexes to the `gameId` field in both Player and GameState models:

```typescript
// In packages/remote-state/src/database/models/Player.ts
@ForeignKey(() => Game)
@Index  // Add index
@Column({
  type: DataType.STRING,
  allowNull: false,
})
declare gameId: string;
```

```typescript
// In packages/remote-state/src/database/models/GameState.ts
@ForeignKey(() => Game)
@Index  // Add index
@Column({
  type: DataType.STRING,
  allowNull: false,
})
declare gameId: string;
```

## 5. Add composite index for better query performance

### Add composite index on gameId and createdAt in GameState

Add a composite index for better query performance:

```typescript
// In packages/remote-state/src/database/models/GameState.ts
@Table({
  tableName: "gameStates",
  timestamps: true,
  indexes: [
    {
      unique: false,
      fields: ["gameId", "createdAt"],
    },
  ],
})
export class GameState extends Model<GameState> {
  // ... existing code
}
```
