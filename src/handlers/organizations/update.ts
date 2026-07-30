import { withHandler, ok, parseJsonBody } from '../../lib/http';
import { requireParam } from '../../lib/params';
import { updateOrganizationSchema } from '../../validation/organization';
import { prisma } from '../../lib/prisma';
import { requireUser, assertHasRole } from '../../lib/auth-context';

export const handler = withHandler(async (event) => {
  const user = await requireUser(event);
  const id = requireParam(event, 'id');
  const input = updateOrganizationSchema.parse(parseJsonBody(event));

  await assertHasRole(user.id, { organizationId: id }, ['ORG_ADMIN']);

  const organization = await prisma.organization.update({ where: { id }, data: input });
  return ok(organization);
});
