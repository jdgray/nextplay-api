import { z } from './zod-openapi';

export const updateUserSchema = z
  .object({
    fullName: z.string().min(1).max(200),
  })
  .partial()
  .openapi('UpdateUser');

export const roleNameSchema = z
  .enum(['ORG_ADMIN', 'COACH', 'ASSISTANT_COACH', 'TEAM_MANAGER', 'VIEWER'])
  .openapi('RoleName');

export const assignRoleSchema = z
  .object({
    role: roleNameSchema,
    organizationId: z.string().uuid().optional(),
    teamId: z.string().uuid().optional(),
  })
  .refine((data) => Number(!!data.organizationId) + Number(!!data.teamId) === 1, {
    message: 'Exactly one of organizationId or teamId must be provided',
  })
  .openapi('AssignRole');

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type AssignRoleInput = z.infer<typeof assignRoleSchema>;
