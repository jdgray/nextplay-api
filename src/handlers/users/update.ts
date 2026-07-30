import { withHandler, ok, parseJsonBody } from '../../lib/http';
import { requireParam } from '../../lib/params';
import { updateUserSchema } from '../../validation/user';
import { prisma } from '../../lib/prisma';
import { requireUser } from '../../lib/auth-context';
import { ForbiddenError } from '../../lib/errors';

export const handler = withHandler(async (event) => {
  const caller = await requireUser(event);
  const id = requireParam(event, 'id');
  const input = updateUserSchema.parse(parseJsonBody(event));

  if (caller.id !== id) {
    throw new ForbiddenError('You can only update your own profile');
  }

  const user = await prisma.user.update({ where: { id }, data: input });
  return ok({ id: user.id, email: user.email, fullName: user.fullName });
});
