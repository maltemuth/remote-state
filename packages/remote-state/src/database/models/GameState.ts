import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
  Default,
} from 'sequelize-typescript';
import { Game } from './Game.js';
import { randomUUID } from 'crypto';

/**
 * One row per state of a game: the initial state has sequence 0, and every accepted
 * action appends the resulting state with the next sequence number.
 */
@Table({
  tableName: 'gameStates',
  timestamps: true,
  indexes: [{ name: 'game-id-and-sequence', unique: true, fields: ['gameId', 'sequence'] }],
})
export class GameState extends Model<GameState> {
  @PrimaryKey
  @Default(randomUUID)
  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  declare id: string;

  @ForeignKey(() => Game)
  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare gameId: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare sequence: number;

  @Column({
    type: DataType.JSON,
    allowNull: true,
  })
  declare state?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare playerId: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare actionType: string;

  @Column({
    type: DataType.JSON,
    allowNull: true,
  })
  declare actionData?: string;

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

  // Associations
  @BelongsTo(() => Game)
  declare game: Game;
}
