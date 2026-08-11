import { withHandler, ok } from '../../lib/http';
import { requireParam } from '../../lib/params';
import { prisma } from '../../lib/prisma';
import { requireUser, assertHasRole } from '../../lib/auth-context';
import { ForbiddenError, NotFoundError } from '../../lib/errors';

export const handler = withHandler(async (event) => {
  const user = await requireUser(event);
  const id = requireParam(event, 'id');

  const defensiveEvent = await prisma.defensiveEvent.findUnique({
    where: { id },
    include: { game: { include: { team: true } } },
  });
  if (!defensiveEvent) {
    throw new NotFoundError('DefensiveEvent');
  }
  if (!defensiveEvent.game) {
    // Unreconciled event (needsReview) with no resolved game — only org/team
    // staff with access to the wider team roster should see it.
    throw new ForbiddenError('This event has not been reconciled to a game yet');
  }

  await assertHasRole(
    user.id,
    { organizationId: defensiveEvent.game.team.organizationId, teamId: defensiveEvent.game.teamId },
    ['ORG_ADMIN', 'TEAM_ADMIN', 'PARENT'],
  );

  const { game: _game, ...rest } = defensiveEvent;
  return ok(rest);
});
