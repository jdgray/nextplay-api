import { z } from './zod-openapi';

export const attackSourceSchema = z.enum(['LEFT', 'CENTER', 'RIGHT']).openapi('AttackSource');

export const defensiveEventEntrySchema = z
  .object({
    gameId: z.string().uuid().optional(),
    opponentNameRaw: z.string().min(1).max(200),
    needsReview: z.boolean().default(false),
    minute: z.number().int().nonnegative(),
    goalAgainst: z.boolean(),
    goalScorerOpponent: z.string().max(200).optional(),
    goalkeeperId: z.string().uuid().optional(),
    leftBackId: z.string().uuid().optional(),
    cdmId: z.string().uuid().optional(),
    rightBackId: z.string().uuid().optional(),
    defensiveErrorPlayerId: z.string().uuid().optional(),
    missedHelpPlayerId: z.string().uuid().optional(),
    defensiveShape: z.string().max(100).optional(),
    attackSource: attackSourceSchema.optional(),
    goalTypeNotes: z.string().optional(),
    minutesInPositionBeforeGoal: z.number().int().nonnegative().optional(),
  })
  .openapi('DefensiveEventEntry');

export const bulkImportDefensiveEventsSchema = z
  .object({
    entries: z.array(defensiveEventEntrySchema).min(1),
  })
  .openapi('BulkImportDefensiveEvents');

// Each entry's `gameId`, if present, must belong to the team the bulk-import
// route is scoped to (checked in the handler) — entries without a resolved
// gameId are inserted with needsReview left as provided.

export type DefensiveEventEntryInput = z.infer<typeof defensiveEventEntrySchema>;
export type BulkImportDefensiveEventsInput = z.infer<typeof bulkImportDefensiveEventsSchema>;
