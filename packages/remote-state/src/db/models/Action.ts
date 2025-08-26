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
  id: string = '';

  @ForeignKey(() => Game)
  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  gameId!: string;

  @ForeignKey(() => Player)
  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  playerId!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  actionType!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  actionData?: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  gameState?: string;

  @CreatedAt
  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: 'timestamp',
  })
  timestamp!: Date;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  validationResult?: string;

  // Associations
  @BelongsTo(() => Game)
  game!: Game;

  @BelongsTo(() => Player)
  player!: Player;
}
