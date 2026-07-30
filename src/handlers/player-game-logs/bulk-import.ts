import { withHandler, created, parseJsonBody } from '../../lib/http';
import { bulkImportPlayerGameLogsSchema } from '../../validation/player-game-log';
import { prisma } from '../../lib/prisma';
import { requireUser, assertHasRole } from '../../lib/auth-context';
import { NotFoundError } from '../../lib/errors';

export const handler = withHandler(async (event) => {
  const user = await requireUser(event);
  const { entries } = bulkImportPlayerGameLogsSchema.parse(parseJsonBody(event));

  const gameIds = [...new Set(entries.map((e) => e.gameId))];
  const games = await prisma.game.findMany({ where: { id: { in: gameIds } }, include: { team: true } });
  if (games.length !== gameIds.length) {
    throw new NotFoundError('Game');
  }

  for (const game of games) {
    await assertHasRole(user.id, { organizationId: game.team.organizationId, teamId: game.teamId }, [
      'ORG_ADMIN',
      'COACH',
      'TEAM_MANAGER',
    ]);
  }

  const scalarData = (entry: (typeof entries)[number]) => ({
    starter: entry.starter,
    goalsCount: entry.goalEvents.length,
    assistsCount: entry.assistEvents.length,
    totalTimeInGameMinutes: entry.totalTimeInGameMinutes,
    onBenchMinutes: entry.onBenchMinutes,
    notes: entry.notes,
  });

  // Upsert scalar fields first, then unconditionally replace each log's
  // children (delete + recreate) — simpler than reconciling diffs, and cheap
  // at this data volume (a handful of sub/goal/assist rows per log).
  const results = await prisma.$transaction(
    entries.map((entry) =>
      prisma.playerGameLog.upsert({
        where: { gameId_playerId: { gameId: entry.gameId, playerId: entry.playerId } },
        create: { gameId: entry.gameId, playerId: entry.playerId, ...scalarData(entry) },
        update: scalarData(entry),
      }),
    ),
  );

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const logId = results[i].id;
    await prisma.$transaction([
      prisma.subInterval.deleteMany({ where: { playerGameLogId: logId } }),
      prisma.goalEvent.deleteMany({ where: { playerGameLogId: logId } }),
      prisma.assistEvent.deleteMany({ where: { playerGameLogId: logId } }),
      prisma.subInterval.createMany({
        data: entry.subIntervals.map((s) => ({ ...s, playerGameLogId: logId })),
      }),
      prisma.goalEvent.createMany({
        data: entry.goalEvents.map((g) => ({ ...g, playerGameLogId: logId })),
      }),
      prisma.assistEvent.createMany({
        data: entry.assistEvents.map((a) => ({ ...a, playerGameLogId: logId })),
      }),
    ]);
  }

  return created({ count: results.length, ids: results.map((r) => r.id) });
});
