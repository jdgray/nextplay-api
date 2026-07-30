import { withHandler, ok, parseJsonBody } from '../../lib/http';
import { loginSchema } from '../../validation/auth';
import { cognitoLogin } from '../../lib/cognito';
import { UnauthorizedError } from '../../lib/errors';

export const handler = withHandler(async (event) => {
  const { email, password } = loginSchema.parse(parseJsonBody(event));
  const result = await cognitoLogin(email, password);
  const tokens = result.AuthenticationResult;
  if (!tokens) {
    throw new UnauthorizedError('Login failed');
  }
  return ok({
    accessToken: tokens.AccessToken,
    idToken: tokens.IdToken,
    refreshToken: tokens.RefreshToken,
    expiresIn: tokens.ExpiresIn,
  });
});
