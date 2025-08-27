import { z } from 'zod';

export const GameDataSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
});

export const PlayerDataSchema = z.object({
  id: z.string(),
  gameId: z.string(),
  name: z.string().min(1),
  role: z.enum(['player', 'admin']),
  token: z.string().optional(),
  tokenType: z.enum(['owner', 'identity']).optional(),
});
