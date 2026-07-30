import type { RoleName } from '@prisma/client';
import { prisma } from './prisma';
import { ForbiddenError, UnauthorizedError } from './errors';
import type { ApiEvent } from './http';

export interface AuthClaims {
  cognitoSub: string;
  email: string;
}

/** Reads the verified JWT claims API Gateway's Cognito authorizer attaches to the request. */
export function getAuthClaims(event: ApiEvent): AuthClaims {
  const claims = event.requestContext?.authorizer?.jwt?.claims as Record<string, string> | undefined;
  const cognitoSub = claims?.sub;
  const email = claims?.email;
  if (!cognitoSub || !email) {
    throw new UnauthorizedError('Missing or invalid authorization token');
  }
  return { cognitoSub, email };
}

/** Resolves the verified caller to our local `User` row (created during /auth/signup). */
export async function requireUser(event: ApiEvent) {
  const { cognitoSub } = getAuthClaims(event);
  const user = await prisma.user.findUnique({ where: { cognitoSub } });
  if (!user) {
    throw new UnauthorizedError('No local user record for this account');
  }
  return user;
}

/**
 * Asserts the caller holds one of `allowedRoles` scoped to the given
 * organization or team (an org-level role also satisfies a team-level check
 * for teams under that org).
 */
export async function assertHasRole(
  userId: string,
  scope: { organizationId?: string; teamId?: string },
  allowedRoles: RoleName[],
): Promise<void> {
  const orgId = scope.organizationId ?? (await resolveOrgIdForTeam(scope.teamId));

  const roles = await prisma.userRole.findMany({
    where: {
      userId,
      role: { in: allowedRoles },
      OR: [{ organizationId: orgId }, ...(scope.teamId ? [{ teamId: scope.teamId }] : [])],
    },
  });

  if (roles.length === 0) {
    throw new ForbiddenError('You do not have the required role for this action');
  }
}

async function resolveOrgIdForTeam(teamId?: string): Promise<string | undefined> {
  if (!teamId) return undefined;
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { organizationId: true } });
  return team?.organizationId;
}
