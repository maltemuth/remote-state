import { Game } from './Game.js';
import { GameState } from './GameState.js';
import { Player } from './Player.js';

export { Game, GameState, Player };
export type { PlayerRole } from './Player.js';

export const entities = [Game, Player, GameState];
