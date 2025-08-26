import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  CreatedAt,
  UpdatedAt,
  HasMany,
  HasOne,
} from 'sequelize-typescript';
import { Player } from './Player';
import { Action } from './Action';
import { GameState } from './GameState';

@Table({
  tableName: 'games',
  timestamps: true,
})
export class Game extends Model {
  @PrimaryKey
  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  id!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  name!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: 'waiting',
  })
  status!: string;

  @CreatedAt
  @Column({
    type: DataType.DATE,
    allowNull: false,
  })
  createdAt!: Date;

  @UpdatedAt
  @Column({
    type: DataType.DATE,
    allowNull: false,
  })
  updatedAt!: Date;

  // Associations
  @HasMany(() => Player)
  players!: Player[];

  @HasMany(() => Action)
  actions!: Action[];

  @HasOne(() => GameState)
  gameState!: GameState;
}
