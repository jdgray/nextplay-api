import { withHandler, created, parseJsonBody } from '../../lib/http';
import { requireParam } from '../../lib/params';
import { assignRoleSchema } from '../../validation/user';
import { prisma } from '../../lib/prisma';
import { requireUser, assertHasRole } from '../../lib/auth-context';
import { NotFoundError } from '../../lib/errors';

export const handler = withHandler(async (event) => {
  const caller = await requireUser(event);
  const targetUserId = requireParam(event, 'id');
  const input = assignRoleSchema.parse(parseJsonBody(event));

  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!targetUser) {
    throw new NotFoundError('User');
  }

  await assertHasRole(
    caller.id,
    { organizationId: input.organizationId, teamId: input.teamId },
    ['ORG_ADMIN'],
  );

  const role = await prisma.userRole.create({
    data: {
      userId: targetUserId,
      organizationId: input.organizationId,
      teamId: input.teamId,
      role: input.role,
    },
  });

  return created(role);
});
