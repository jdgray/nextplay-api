import { withHandler, ok } from '../../lib/http';
import { requireParam } from '../../lib/params';
import { prisma } from '../../lib/prisma';
import { requireUser, assertHasRole } from '../../lib/auth-context';
import { NotFoundError } from '../../lib/errors';

export const handler = withHandler(async (event) => {
  const user = await requireUser(event);
  const id = requireParam(event, 'id');

  const player = await prisma.player.findUnique({ where: { id }, include: { team: true } });
  if (!player) {
    throw new NotFoundError('Player');
  }

  await assertHasRole(user.id, { organizationId: player.team.organizationId, teamId: player.teamId }, [
    'ORG_ADMIN',
    'COACH',
    'ASSISTANT_COACH',
    'TEAM_MANAGER',
    'VIEWER',
  ]);

  const { team: _team, ...rest } = player;
  return ok(rest);
});
