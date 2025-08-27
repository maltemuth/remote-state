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
export class Player extends Model<Player> {
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
    type: DataType.STRING,
    allowNull: false,
  })
  declare name: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: 'player',
  })
  declare role: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare token?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare tokenType?: string;

  @CreatedAt
  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: 'joinedAt',
  })
  declare joinedAt: Date;

  // Associations
  @BelongsTo(() => Game)
  declare game: Game;

  @HasMany(() => Action)
  declare actions: Action[];
}
