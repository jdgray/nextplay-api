/**
 * One-off script: creates a local `User` row (and an ORG_ADMIN `UserRole` on
 * the existing Test Org) for a Cognito identity that was created directly
 * against the pool (e.g. via `aws cognito-idp admin-create-user`) rather than
 * through POST /auth/signup — which is the only flow that normally creates
 * this row. Without it, `requireUser` 401s every protected request for that
 * account even with a perfectly valid Cognito JWT.
 *
 * Run with: npx ts-node scripts/seed-local-user.ts
 */
import { prisma } from '../src/lib/prisma';

const COGNITO_SUB = 'c861f300-90c1-70af-29ae-531bb782bcfa';
const EMAIL = 'jonathon.d.gray@gmail.com';
const FULL_NAME = 'Jonathon Gray';

async function main() {
  const user = await prisma.user.upsert({
    where: { cognitoSub: COGNITO_SUB },
    update: {},
    create: { cognitoSub: COGNITO_SUB, email: EMAIL, fullName: FULL_NAME },
  });
  console.log('User:', user);

  const org = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!org) {
    console.log('No organization exists yet to grant a role on — skipping UserRole.');
    return;
  }

  const existingRole = await prisma.userRole.findFirst({
    where: { userId: user.id, organizationId: org.id, role: 'ORG_ADMIN' },
  });
  const role =
    existingRole ??
    (await prisma.userRole.create({
      data: { userId: user.id, organizationId: org.id, role: 'ORG_ADMIN' },
    }));
  console.log('UserRole:', role);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
