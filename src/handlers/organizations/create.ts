import { withHandler, created, parseJsonBody } from '../../lib/http';
import { createOrganizationSchema } from '../../validation/organization';
import { prisma } from '../../lib/prisma';
import { requireUser } from '../../lib/auth-context';

export const handler = withHandler(async (event) => {
  const user = await requireUser(event);
  const input = createOrganizationSchema.parse(parseJsonBody(event));

  const organization = await prisma.organization.create({ data: input });

  // Creator becomes the first org admin.
  await prisma.userRole.create({
    data: { userId: user.id, organizationId: organization.id, role: 'ORG_ADMIN' },
  });

  return created(organization);
});
