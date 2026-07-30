import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  GlobalSignOutCommand,
  AuthFlowType,
} from '@aws-sdk/client-cognito-identity-provider';
import { AppError } from './errors';

const client = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

function clientId(): string {
  const id = process.env.COGNITO_USER_POOL_CLIENT_ID;
  if (!id) {
    throw new AppError('Server misconfiguration: COGNITO_USER_POOL_CLIENT_ID is not set', 500);
  }
  return id;
}

export async function cognitoSignUp(email: string, password: string, fullName: string) {
  const command = new SignUpCommand({
    ClientId: clientId(),
    Username: email,
    Password: password,
    UserAttributes: [
      { Name: 'email', Value: email },
      { Name: 'name', Value: fullName },
    ],
  });
  return client.send(command);
}

export async function cognitoConfirmSignUp(email: string, code: string) {
  const command = new ConfirmSignUpCommand({
    ClientId: clientId(),
    Username: email,
    ConfirmationCode: code,
  });
  return client.send(command);
}

export async function cognitoLogin(email: string, password: string) {
  const command = new InitiateAuthCommand({
    ClientId: clientId(),
    AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
    AuthParameters: { USERNAME: email, PASSWORD: password },
  });
  return client.send(command);
}

export async function cognitoRefresh(refreshToken: string) {
  const command = new InitiateAuthCommand({
    ClientId: clientId(),
    AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
    AuthParameters: { REFRESH_TOKEN: refreshToken },
  });
  return client.send(command);
}

export async function cognitoGlobalSignOut(accessToken: string) {
  const command = new GlobalSignOutCommand({ AccessToken: accessToken });
  return client.send(command);
}
