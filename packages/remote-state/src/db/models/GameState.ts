import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  Default,
} from 'sequelize-typescript';
import { Game } from './Game';
import { v4 as uuidv4 } from 'uuid';

@Table({
  tableName: 'gameStates',
  timestamps: false,
})
export class GameState extends Model<GameState> {
  @PrimaryKey
  @Default(uuidv4)
  @Column({
    type: DataType.UUID,
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
    type: DataType.TEXT,
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
    type: DataType.TEXT,
    allowNull: true,
  })
  declare actionData?: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare validationResult?: string;

  @CreatedAt
  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: 'timestamp',
  })
  declare timestamp: Date;

  // Associations
  @BelongsTo(() => Game)
  declare game: Game;
}
