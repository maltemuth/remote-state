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
  createIndexDecorator,
  AutoIncrement,
} from 'sequelize-typescript';
import { Game } from './Game';
import { v4 as uuidv4 } from 'uuid';

const GameIdSequenceIndex = createIndexDecorator({
  name: 'game-id-and-sequence',
  type: 'UNIQUE',
  concurrently: true,
});

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
  @GameIdSequenceIndex
  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare gameId: string;

  @GameIdSequenceIndex
  @AutoIncrement
  @Column({
    type: DataType.INTEGER,
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

export interface DeserializedGameState<StateType> extends Omit<GameState, 'state'> {
  state: StateType;
}
