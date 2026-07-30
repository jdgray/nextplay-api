import { withHandler, ok, parseJsonBody } from '../../lib/http';
import { confirmSignupSchema } from '../../validation/auth';
import { cognitoConfirmSignUp } from '../../lib/cognito';

export const handler = withHandler(async (event) => {
  const { email, code } = confirmSignupSchema.parse(parseJsonBody(event));
  await cognitoConfirmSignUp(email, code);
  return ok({ message: 'Account confirmed' });
});
