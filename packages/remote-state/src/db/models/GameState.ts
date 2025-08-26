import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
  UpdatedAt,
} from 'sequelize-typescript';
import { Game } from './Game';

@Table({
  tableName: 'gameStates',
  timestamps: false,
})
export class GameState extends Model {
  @PrimaryKey
  @ForeignKey(() => Game)
  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  gameId!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  state?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  lastActionId?: string;

  @UpdatedAt
  @Column({
    type: DataType.DATE,
    allowNull: false,
  })
  updatedAt!: Date;

  // Associations
  @BelongsTo(() => Game)
  game!: Game;
}
