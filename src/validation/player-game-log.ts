import { z } from './zod-openapi';

const subIntervalSchema = z
  .object({
    sequence: z.number().int().positive(),
    timeInMinute: z.number().int().nonnegative(),
    timeOutMinute: z.number().int().nonnegative().optional(),
  })
  .openapi('SubInterval');

const goalOrAssistEventSchema = z
  .object({
    sequence: z.number().int().positive(),
    minute: z.number().int().nonnegative(),
    position: z.string().max(100).optional(),
  })
  .openapi('GoalOrAssistEvent');

export const playerGameLogEntrySchema = z
  .object({
    gameId: z.string().uuid(),
    playerId: z.string().uuid(),
    starter: z.boolean().optional(),
    totalTimeInGameMinutes: z.number().int().nonnegative().optional(),
    onBenchMinutes: z.number().int().nonnegative().optional(),
    notes: z.string().optional(),
    subIntervals: z.array(subIntervalSchema).default([]),
    goalEvents: z.array(goalOrAssistEventSchema).default([]),
    assistEvents: z.array(goalOrAssistEventSchema).default([]),
  })
  .openapi('PlayerGameLogEntry');

export const bulkImportPlayerGameLogsSchema = z
  .object({
    entries: z.array(playerGameLogEntrySchema).min(1),
  })
  .openapi('BulkImportPlayerGameLogs');

export type PlayerGameLogEntryInput = z.infer<typeof playerGameLogEntrySchema>;
export type BulkImportPlayerGameLogsInput = z.infer<typeof bulkImportPlayerGameLogsSchema>;
