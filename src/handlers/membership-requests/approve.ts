import { withHandler, ok } from '../../lib/http';
import { requireParam } from '../../lib/params';
import { prisma } from '../../lib/prisma';
import { requireUser, assertHasRole } from '../../lib/auth-context';
import { ConflictError, NotFoundError } from '../../lib/errors';

/**
 * Approving creates the real UserRole — org-scoped for ORG_ADMIN requests,
 * team-scoped otherwise — mirroring the org-xor-team scoping every other
 * UserRole already uses (see assign-role.ts).
 */
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

  const scope =
    request.requestedRole === 'ORG_ADMIN'
      ? { organizationId: request.organizationId, teamId: undefined }
      : { organizationId: undefined, teamId: request.teamId ?? undefined };

  const [, updated] = await prisma.$transaction([
    prisma.userRole.create({
      data: { userId: request.userId, role: request.requestedRole, ...scope },
    }),
    prisma.membershipRequest.update({
      where: { id },
      data: { status: 'APPROVED', reviewedByUserId: caller.id, reviewedAt: new Date() },
    }),
  ]);

  return ok(updated);
});
