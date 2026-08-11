import { withHandler, created, parseJsonBody } from '../../lib/http';
import { signupSchema } from '../../validation/auth';
import { cognitoSignUp } from '../../lib/cognito';
import { prisma } from '../../lib/prisma';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors';

export const handler = withHandler(async (event) => {
  const { email, password, fullName, organizationId, teamId, requestedRole } = signupSchema.parse(
    parseJsonBody(event),
  );

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ConflictError('An account with this email already exists');
  }

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team || team.organizationId !== organizationId) {
    throw new NotFoundError('Team');
  }
  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) {
    throw new NotFoundError('Organization');
  }
  if (requestedRole !== 'ORG_ADMIN' && requestedRole !== 'TEAM_ADMIN' && requestedRole !== 'PARENT') {
    throw new ValidationError('Invalid requested role');
  }

  const result = await cognitoSignUp(email, password, fullName);
  const cognitoSub = result.UserSub!;

  const user = await prisma.user.create({
    data: { cognitoSub, email, fullName },
  });

  const membershipRequest = await prisma.membershipRequest.create({
    data: { userId: user.id, organizationId, teamId, requestedRole },
  });

  return created({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    confirmationRequired: !result.UserConfirmed,
    membershipRequestId: membershipRequest.id,
  });
});
