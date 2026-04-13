import { z } from "zod";

export const loginClientBodySchema = z
  .object({
    phone_number: z.string().trim().min(3, "phone_number is required"),
    password: z.string().min(4, "password must be at least 4 characters"),
  })
  .strict();

export const loginAdminBodySchema = z
  .object({
    email: z.string().email("email must be valid"),
    password: z.string().min(6, "password must be at least 6 characters"),
  })
  .strict();

