import { z } from './zod-openapi';

export const createGameSchema = z
  .object({
    opponentName: z.string().min(1).max(200),
    gameDate: z.string().date().optional(),
    leagueType: z.string().min(1).max(100).optional(),
    externalGameId: z.number().int().optional(),
  })
  .openapi('CreateGame');

export const updateGameSchema = createGameSchema.partial().openapi('UpdateGame');

export type CreateGameInput = z.infer<typeof createGameSchema>;
export type UpdateGameInput = z.infer<typeof updateGameSchema>;
