import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
  CreatedAt,
} from 'sequelize-typescript';
import { Game } from './Game';

@Table({
  tableName: 'gameStates',
  timestamps: false,
})
export class GameState extends Model<GameState> {
  @PrimaryKey
  @Column({
    type: DataType.STRING,
    allowNull: false,
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
