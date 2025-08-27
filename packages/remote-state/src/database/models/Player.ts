import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
  Default,
  Index,
} from 'sequelize-typescript';
import { Game } from './Game';
import { v4 as uuidv4 } from 'uuid';

@Table({
  tableName: 'players',
  timestamps: true,
})
export class Player extends Model<Player> {
  @PrimaryKey
  @Default(uuidv4)
  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  declare id: string;

  @ForeignKey(() => Game)
  @Index
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

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare lastActivityAt: Date | null;

  // Associations
  @BelongsTo(() => Game)
  declare game: Game;
}
