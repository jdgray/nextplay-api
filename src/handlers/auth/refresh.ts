import { withHandler, ok, parseJsonBody } from '../../lib/http';
import { refreshSchema } from '../../validation/auth';
import { cognitoRefresh } from '../../lib/cognito';
import { UnauthorizedError } from '../../lib/errors';

export const handler = withHandler(async (event) => {
  const { refreshToken } = refreshSchema.parse(parseJsonBody(event));
  const result = await cognitoRefresh(refreshToken);
  const tokens = result.AuthenticationResult;
  if (!tokens) {
    throw new UnauthorizedError('Refresh failed');
  }
  return ok({
    accessToken: tokens.AccessToken,
    idToken: tokens.IdToken,
    expiresIn: tokens.ExpiresIn,
  });
});
