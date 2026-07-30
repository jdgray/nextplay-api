import { withHandler, ok } from '../../lib/http';
import { requireParam } from '../../lib/params';
import { prisma } from '../../lib/prisma';
import { requireUser, assertHasRole } from '../../lib/auth-context';
import { NotFoundError } from '../../lib/errors';

export const handler = withHandler(async (event) => {
  const user = await requireUser(event);
  const id = requireParam(event, 'id');

  const game = await prisma.game.findUnique({ where: { id }, include: { team: true } });
  if (!game) {
    throw new NotFoundError('Game');
  }

  await assertHasRole(user.id, { organizationId: game.team.organizationId, teamId: game.teamId }, [
    'ORG_ADMIN',
    'COACH',
    'ASSISTANT_COACH',
    'TEAM_MANAGER',
    'VIEWER',
  ]);

  const { team: _team, ...rest } = game;
  return ok(rest);
});
