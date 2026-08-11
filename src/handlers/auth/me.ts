import { withHandler, ok } from '../../lib/http';
import { requireUser } from '../../lib/auth-context';
import { prisma } from '../../lib/prisma';

export const handler = withHandler(async (event) => {
  const user = await requireUser(event);
  const roles = await prisma.userRole.findMany({ where: { userId: user.id } });

  const pendingRequest = await prisma.membershipRequest.findFirst({
    where: { userId: user.id, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });

  return ok({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    roles: roles.map((r) => ({ role: r.role, organizationId: r.organizationId, teamId: r.teamId })),
    pendingRequest: pendingRequest
      ? {
          organizationId: pendingRequest.organizationId,
          teamId: pendingRequest.teamId,
          requestedRole: pendingRequest.requestedRole,
          status: pendingRequest.status,
        }
      : null,
  });
});
