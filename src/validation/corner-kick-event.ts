import { z } from './zod-openapi';

export const cornerSideSchema = z.enum(['LEFT', 'RIGHT']).openapi('CornerSide');
export const cornerTypeSchema = z.enum(['IN', 'OUT', 'SHORT', 'PASS']).openapi('CornerType');

export const cornerKickEventEntrySchema = z
  .object({
    gameId: z.string().uuid().optional(),
    opponentNameRaw: z.string().min(1).max(200),
    needsReview: z.boolean().default(false),
    minute: z.number().int().nonnegative(),
    side: cornerSideSchema.optional(),
    takerId: z.string().uuid().optional(),
    type: cornerTypeSchema.optional(),
    targetZone: z.string().max(100).optional(),
    outcome: z.string().max(200).optional(),
    shot: z.boolean().default(false),
    goal: z.boolean().default(false),
    receiverId: z.string().uuid().optional(),
    notes: z.string().optional(),
  })
  .openapi('CornerKickEventEntry');

export const bulkImportCornerKickEventsSchema = z
  .object({
    entries: z.array(cornerKickEventEntrySchema).min(1),
  })
  .openapi('BulkImportCornerKickEvents');

// Same team-scoping note as bulkImportDefensiveEventsSchema: gameId is
// resolved/validated by the handler against the route's teamId.

export type CornerKickEventEntryInput = z.infer<typeof cornerKickEventEntrySchema>;
export type BulkImportCornerKickEventsInput = z.infer<typeof bulkImportCornerKickEventsSchema>;
