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
  Index,
} from 'sequelize-typescript';
import { Game } from './Game';
import { v4 as uuidv4 } from 'uuid';

@Table({
  tableName: 'gameStates',
  timestamps: true,
})
export class GameState extends Model<GameState> {
  @PrimaryKey
  @Default(uuidv4)
  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  declare id: string;

  @ForeignKey(() => Game)
  @Index
  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare gameId: string;

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

export interface DeserializedGameState<StateType> extends Omit<GameState, 'state'> {
  state: StateType;
}
