import { withHandler, created, parseJsonBody } from '../../lib/http';
import { requireParam } from '../../lib/params';
import { createPlayerSchema } from '../../validation/player';
import { prisma } from '../../lib/prisma';
import { requireUser, assertHasRole } from '../../lib/auth-context';
import { NotFoundError } from '../../lib/errors';

export const handler = withHandler(async (event) => {
  const user = await requireUser(event);
  const teamId = requireParam(event, 'teamId');
  const input = createPlayerSchema.parse(parseJsonBody(event));

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    throw new NotFoundError('Team');
  }

  await assertHasRole(user.id, { organizationId: team.organizationId, teamId }, [
    'ORG_ADMIN',
    'COACH',
    'TEAM_MANAGER',
  ]);

  const player = await prisma.player.create({ data: { ...input, teamId } });
  return created(player);
});
