import { withHandler, created, parseJsonBody } from '../../lib/http';
import { requireParam } from '../../lib/params';
import { createGameSchema } from '../../validation/game';
import { prisma } from '../../lib/prisma';
import { requireUser, assertHasRole } from '../../lib/auth-context';
import { NotFoundError } from '../../lib/errors';

export const handler = withHandler(async (event) => {
  const user = await requireUser(event);
  const teamId = requireParam(event, 'teamId');
  const input = createGameSchema.parse(parseJsonBody(event));

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    throw new NotFoundError('Team');
  }

  await assertHasRole(user.id, { organizationId: team.organizationId, teamId }, [
    'ORG_ADMIN',
    'COACH',
    'TEAM_MANAGER',
  ]);

  const game = await prisma.game.create({
    data: {
      teamId,
      opponentName: input.opponentName,
      gameDate: input.gameDate ? new Date(input.gameDate) : undefined,
      leagueType: input.leagueType,
      externalGameId: input.externalGameId,
    },
  });
  return created(game);
});
