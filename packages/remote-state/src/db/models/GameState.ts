import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { Game } from './Game';

@Table({
  tableName: 'gameStates',
  timestamps: false,
})
export class GameState extends Model<GameState> {
  @PrimaryKey
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
  declare lastActionId?: string;

  // Associations
  @BelongsTo(() => Game)
  declare game: Game;
}
