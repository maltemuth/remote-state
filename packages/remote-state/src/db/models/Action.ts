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
import { Player } from './Player';

@Table({
  tableName: 'actions',
  timestamps: false,
})
export class Action extends Model<Action> {
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

  @ForeignKey(() => Player)
  @Column({
    type: DataType.STRING,
    allowNull: false,
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
  declare gameState?: string;

  @CreatedAt
  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: 'timestamp',
  })
  declare timestamp: Date;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare validationResult?: string;

  // Associations
  @BelongsTo(() => Game)
  declare game: Game;

  @BelongsTo(() => Player)
  declare player: Player;
}
