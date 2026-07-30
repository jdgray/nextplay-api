import { withHandler, ok } from '../../lib/http';
import { requireParam } from '../../lib/params';
import { prisma } from '../../lib/prisma';
import { requireUser, assertHasRole } from '../../lib/auth-context';
import { NotFoundError } from '../../lib/errors';

export const handler = withHandler(async (event) => {
  const user = await requireUser(event);
  const id = requireParam(event, 'id');

  const log = await prisma.playerGameLog.findUnique({
    where: { id },
    include: {
      subIntervals: true,
      goalEvents: true,
      assistEvents: true,
      player: true,
      game: { include: { team: true } },
    },
  });
  if (!log) {
    throw new NotFoundError('PlayerGameLog');
  }

  await assertHasRole(
    user.id,
    { organizationId: log.game.team.organizationId, teamId: log.game.teamId },
    ['ORG_ADMIN', 'COACH', 'ASSISTANT_COACH', 'TEAM_MANAGER', 'VIEWER'],
  );

  const { game: _game, ...rest } = log;
  return ok(rest);
});
