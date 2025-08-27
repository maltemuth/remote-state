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
  tableName: 'players',
  timestamps: false,
})
export class Player extends Model<Player> {
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
}
