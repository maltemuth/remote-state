import { z } from 'zod';

export const GameDataSchema = z.object({
  name: z.string().min(1),
});

export const AddPlayerDataSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  role: z.enum(['player', 'admin']),
});
