import { withHandler, ok } from '../../lib/http';
import { requireParam } from '../../lib/params';
import { prisma } from '../../lib/prisma';
import { requireUser, assertHasRole } from '../../lib/auth-context';
import { ForbiddenError, NotFoundError } from '../../lib/errors';

export const handler = withHandler(async (event) => {
  const user = await requireUser(event);
  const id = requireParam(event, 'id');

  const cornerKickEvent = await prisma.cornerKickEvent.findUnique({
    where: { id },
    include: { game: { include: { team: true } } },
  });
  if (!cornerKickEvent) {
    throw new NotFoundError('CornerKickEvent');
  }
  if (!cornerKickEvent.game) {
    throw new ForbiddenError('This event has not been reconciled to a game yet');
  }

  await assertHasRole(
    user.id,
    { organizationId: cornerKickEvent.game.team.organizationId, teamId: cornerKickEvent.game.teamId },
    ['ORG_ADMIN', 'TEAM_ADMIN', 'PARENT'],
  );

  const { game: _game, ...rest } = cornerKickEvent;
  return ok(rest);
});
