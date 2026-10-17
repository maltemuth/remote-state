/**
 * All persisted entities, for MikroORM's configuration and for imports elsewhere.
 */

import { AdmissionCode } from './AdmissionCode.js';
import { AudienceMembership } from './AudienceMembership.js';
import { Game } from './Game.js';
import { GameState } from './GameState.js';
import { Player } from './Player.js';
import { Token } from './Token.js';

export { AdmissionCode, AudienceMembership, Game, GameState, Player, Token };

export const entities = [Game, Player, Token, AdmissionCode, GameState, AudienceMembership];
