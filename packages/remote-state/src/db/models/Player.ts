import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
  HasMany,
  CreatedAt,
} from 'sequelize-typescript';
import { Game } from './Game';
import { Action } from './Action';

@Table({
  tableName: 'players',
  timestamps: false,
})
export class Player extends Model {
  @PrimaryKey
  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  id!: string;

  @ForeignKey(() => Game)
  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  gameId!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  name!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: 'player',
  })
  role!: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  token?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  tokenType?: string;

  @CreatedAt
  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: 'joinedAt',
  })
  joinedAt!: Date;

  // Associations
  @BelongsTo(() => Game)
  game!: Game;

  @HasMany(() => Action)
  actions!: Action[];
}
