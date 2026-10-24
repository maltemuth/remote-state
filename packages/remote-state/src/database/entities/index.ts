/**
 * All persisted entities, for MikroORM's configuration and for imports elsewhere.
 */

import { AdmissionCode } from './AdmissionCode.js';
import { AudienceMembership } from './AudienceMembership.js';
import { Space } from './Space.js';
import { SpaceState } from './SpaceState.js';
import { Member } from './Member.js';
import { Token } from './Token.js';

export { AdmissionCode, AudienceMembership, Space, SpaceState, Member, Token };

export const entities = [Space, Member, Token, AdmissionCode, SpaceState, AudienceMembership];
