import { withHandler, created, parseJsonBody } from '../../lib/http';
import { requireParam } from '../../lib/params';
import { bulkImportDefensiveEventsSchema } from '../../validation/defensive-event';
import { prisma } from '../../lib/prisma';
import { requireUser, assertHasRole } from '../../lib/auth-context';
import { NotFoundError, ValidationError } from '../../lib/errors';

export const handler = withHandler(async (event) => {
  const user = await requireUser(event);
  const teamId = requireParam(event, 'teamId');
  const { entries } = bulkImportDefensiveEventsSchema.parse(parseJsonBody(event));

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    throw new NotFoundError('Team');
  }
  await assertHasRole(user.id, { organizationId: team.organizationId, teamId }, ['ORG_ADMIN', 'TEAM_ADMIN']);

  const gameIds = [...new Set(entries.map((e) => e.gameId).filter((id): id is string => !!id))];
  if (gameIds.length > 0) {
    const games = await prisma.game.findMany({ where: { id: { in: gameIds }, teamId } });
    if (games.length !== gameIds.length) {
      throw new ValidationError('One or more gameId values do not belong to this team');
    }
  }

  const rows = await prisma.$transaction(
    entries.map((entry) => prisma.defensiveEvent.create({ data: entry })),
  );

  return created({ count: rows.length, ids: rows.map((r) => r.id) });
});
