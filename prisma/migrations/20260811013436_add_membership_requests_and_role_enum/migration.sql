-- CreateEnum
CREATE TYPE "MembershipRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum: narrow RoleName from 5 values to 3, remapping existing rows
-- (COACH/ASSISTANT_COACH/TEAM_MANAGER -> TEAM_ADMIN, VIEWER -> PARENT).
-- Postgres enums can't drop/rename values in place, so this is the standard
-- create-new-type / migrate-column / swap-names dance.
BEGIN;
CREATE TYPE "RoleName_new" AS ENUM ('ORG_ADMIN', 'TEAM_ADMIN', 'PARENT');
ALTER TABLE "user_roles" ALTER COLUMN "role" TYPE "RoleName_new" USING (
  CASE "role"::text
    WHEN 'ORG_ADMIN' THEN 'ORG_ADMIN'
    WHEN 'COACH' THEN 'TEAM_ADMIN'
    WHEN 'ASSISTANT_COACH' THEN 'TEAM_ADMIN'
    WHEN 'TEAM_MANAGER' THEN 'TEAM_ADMIN'
    WHEN 'VIEWER' THEN 'PARENT'
  END
)::"RoleName_new";
ALTER TYPE "RoleName" RENAME TO "RoleName_old";
ALTER TYPE "RoleName_new" RENAME TO "RoleName";
DROP TYPE "RoleName_old";
COMMIT;

-- CreateTable
CREATE TABLE "membership_request" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "team_id" UUID,
    "requested_role" "RoleName" NOT NULL,
    "status" "MembershipRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_request_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "membership_request" ADD CONSTRAINT "membership_request_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_request" ADD CONSTRAINT "membership_request_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_request" ADD CONSTRAINT "membership_request_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_request" ADD CONSTRAINT "membership_request_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
