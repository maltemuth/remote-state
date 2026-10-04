/**
 * Random secrets for tokens and admission codes, and the hash under which they're
 * stored (decision 0017). Secrets are long and random, so a fast hash is enough.
 */

import { createHash, randomBytes } from 'crypto';

/** 256 random bits, hex-encoded */
export const newSecret = (): string => randomBytes(32).toString('hex');

export const hashSecret = (secret: string): string =>
  createHash('sha256').update(secret).digest('hex');
