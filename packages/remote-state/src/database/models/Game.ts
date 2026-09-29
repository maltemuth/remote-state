import { Table, Column, Model, DataType, PrimaryKey, HasMany, Default } from 'sequelize-typescript';
import { Player } from './Player';
import { randomUUID } from 'crypto';

@Table({
  tableName: 'games',
  timestamps: true,
})
export class Game extends Model<Game> {
  @PrimaryKey
  @Default(randomUUID)
  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  declare id: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    validate: { notEmpty: true },
  })
  declare name: string;

  // Associations
  @HasMany(() => Player)
  declare players: Player[];
}
