import { Table, Column, Model, DataType, PrimaryKey, HasMany, Default } from 'sequelize-typescript';
import { Player } from './Player';
import { v4 as uuidv4 } from 'uuid';

@Table({
  tableName: 'games',
  timestamps: true,
})
export class Game extends Model<Game> {
  @PrimaryKey
  @Default(uuidv4)
  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
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
