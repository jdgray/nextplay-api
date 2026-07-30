import { z } from './zod-openapi';

export const createOrganizationSchema = z
  .object({
    name: z.string().min(1).max(200),
  })
  .openapi('CreateOrganization');

export const updateOrganizationSchema = createOrganizationSchema.partial().openapi('UpdateOrganization');

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
