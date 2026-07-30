import { z } from './zod-openapi';

export const createTeamSchema = z
  .object({
    name: z.string().min(1).max(200),
    season: z.string().min(1).max(50).optional(),
  })
  .openapi('CreateTeam');

export const updateTeamSchema = createTeamSchema.partial().openapi('UpdateTeam');

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
