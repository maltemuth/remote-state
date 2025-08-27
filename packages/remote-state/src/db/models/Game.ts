import { Table, Column, Model, DataType, PrimaryKey, HasMany } from 'sequelize-typescript';
import { Player } from './Player';

@Table({
  tableName: 'games',
  timestamps: true,
})
export class Game extends Model<Game> {
  @PrimaryKey
  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare id: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare name: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: 'waiting',
  })
  declare status: string;

  // Associations
  @HasMany(() => Player)
  declare players: Player[];
}
