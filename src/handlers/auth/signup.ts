import { withHandler, created, parseJsonBody } from '../../lib/http';
import { signupSchema } from '../../validation/auth';
import { cognitoSignUp } from '../../lib/cognito';
import { prisma } from '../../lib/prisma';
import { ConflictError } from '../../lib/errors';

export const handler = withHandler(async (event) => {
  const { email, password, fullName } = signupSchema.parse(parseJsonBody(event));

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ConflictError('An account with this email already exists');
  }

  const result = await cognitoSignUp(email, password, fullName);
  const cognitoSub = result.UserSub!;

  const user = await prisma.user.create({
    data: { cognitoSub, email, fullName },
  });

  return created({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    confirmationRequired: !result.UserConfirmed,
  });
});
