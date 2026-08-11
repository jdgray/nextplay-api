import { withHandler, ok, parseJsonBody } from '../../lib/http';
import { requireParam } from '../../lib/params';
import { updateGameSchema } from '../../validation/game';
import { prisma } from '../../lib/prisma';
import { requireUser, assertHasRole } from '../../lib/auth-context';
import { NotFoundError } from '../../lib/errors';

export const handler = withHandler(async (event) => {
  const user = await requireUser(event);
  const id = requireParam(event, 'id');
  const input = updateGameSchema.parse(parseJsonBody(event));

  const game = await prisma.game.findUnique({ where: { id }, include: { team: true } });
  if (!game) {
    throw new NotFoundError('Game');
  }

  await assertHasRole(user.id, { organizationId: game.team.organizationId, teamId: game.teamId }, ['ORG_ADMIN', 'TEAM_ADMIN']);

  const updated = await prisma.game.update({
    where: { id },
    data: {
      ...input,
      gameDate: input.gameDate ? new Date(input.gameDate) : undefined,
    },
  });
  return ok(updated);
});
