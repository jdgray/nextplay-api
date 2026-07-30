import { withHandler, ok, parseJsonBody } from '../../lib/http';
import { logoutSchema } from '../../validation/auth';
import { cognitoGlobalSignOut } from '../../lib/cognito';

export const handler = withHandler(async (event) => {
  const { accessToken } = logoutSchema.parse(parseJsonBody(event));
  await cognitoGlobalSignOut(accessToken);
  return ok({ message: 'Logged out' });
});
