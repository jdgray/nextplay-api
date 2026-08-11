import { z } from './zod-openapi';
import { roleNameSchema } from './user';

export const signupSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8).max(256),
    fullName: z.string().min(1).max(200),
    organizationId: z.string().uuid(),
    teamId: z.string().uuid(),
    requestedRole: roleNameSchema,
  })
  .openapi('Signup');

export const confirmSignupSchema = z
  .object({
    email: z.string().email(),
    code: z.string().min(1).max(20),
  })
  .openapi('ConfirmSignup');

export const loginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
  })
  .openapi('Login');

export const refreshSchema = z
  .object({
    refreshToken: z.string().min(1),
  })
  .openapi('Refresh');

export const logoutSchema = z
  .object({
    accessToken: z.string().min(1),
  })
  .openapi('Logout');

export type SignupInput = z.infer<typeof signupSchema>;
export type ConfirmSignupInput = z.infer<typeof confirmSignupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
