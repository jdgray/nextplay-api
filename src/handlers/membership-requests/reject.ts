import { withHandler, ok } from '../../lib/http';
import { requireParam } from '../../lib/params';
import { prisma } from '../../lib/prisma';
import { requireUser, assertHasRole } from '../../lib/auth-context';
import { ConflictError, NotFoundError } from '../../lib/errors';

export const handler = withHandler(async (event) => {
  const caller = await requireUser(event);
  const id = requireParam(event, 'id');

  const request = await prisma.membershipRequest.findUnique({ where: { id } });
  if (!request) {
    throw new NotFoundError('Membership request');
  }
  if (request.status !== 'PENDING') {
    throw new ConflictError('This request has already been reviewed');
  }

  await assertHasRole(caller.id, { organizationId: request.organizationId }, ['ORG_ADMIN']);

  const updated = await prisma.membershipRequest.update({
    where: { id },
    data: { status: 'REJECTED', reviewedByUserId: caller.id, reviewedAt: new Date() },
  });

  return ok(updated);
});
