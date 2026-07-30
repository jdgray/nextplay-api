import { z } from './zod-openapi';

export const createPlayerSchema = z
  .object({
    externalPlayerId: z.string().min(1).max(100),
    rosterLabel: z.string().min(1).max(200),
    fullName: z.string().min(1).max(200),
    jerseyNumber: z.number().int().nonnegative().optional(),
  })
  .openapi('CreatePlayer');

export const updatePlayerSchema = createPlayerSchema.partial().openapi('UpdatePlayer');

export type CreatePlayerInput = z.infer<typeof createPlayerSchema>;
export type UpdatePlayerInput = z.infer<typeof updatePlayerSchema>;
