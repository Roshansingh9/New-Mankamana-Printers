import { z } from "zod";

const orderConfigDetailSchema = z.object({
  groupName: z.string().min(1),
  groupLabel: z.string().min(1),
  selectedCode: z.string().min(1),
  selectedLabel: z.string().min(1),
}).strict();

export const createProductOrderSchema = z.object({
  variantId: z.string().min(1, "variantId is required"),
  quantity: z.coerce.number().int().positive("quantity must be greater than 0"),
  options: z.object({
    configDetails: z.array(orderConfigDetailSchema).optional(),
  }).catchall(z.string().min(1)),
  notes: z.string().max(1000).optional(),
  designCode: z.string().max(50).optional(),
}).strict();

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    "ORDER_PROCESSING",
    "ORDER_DELIVERED",
    "ORDER_CANCELLED",
  ]),
  expected_delivery_date: z.string().optional(), // ISO date string e.g. "2025-05-10"
}).strict();

export const setDeliveryDateSchema = z.object({
  expected_delivery_date: z.string().min(1, "Date is required"),
}).strict();
