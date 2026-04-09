import { z } from "zod";

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected date in YYYY-MM-DD format");

const positiveIntSchema = z.number().int().positive();
const nonNegativeIntSchema = z.number().int().min(0);

const nullablePositiveIdSchema = z.union([positiveIntSchema, z.null()]);

const nullableTrimmedString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  });

export const capacityEntrySchema = z.object({
  id: positiveIntSchema.optional(),
  teamMemberId: positiveIntSchema,
  date: isoDateSchema,
  projectId: nullablePositiveIdSchema.optional().default(null),
  activityId: nullablePositiveIdSchema.optional().default(null),
  locationId: nullablePositiveIdSchema.optional().default(null),
  comment: nullableTrimmedString,
  nightShift: z.boolean().optional().default(false),
});

export const capacityBulkSchema = z.object({
  entries: z.array(capacityEntrySchema).min(1).max(500),
});

export const capacityCreateSchema = capacityEntrySchema.omit({ id: true });

export const capacityUpdateSchema = z
  .object({
    projectId: nullablePositiveIdSchema.optional(),
    activityId: nullablePositiveIdSchema.optional(),
    locationId: nullablePositiveIdSchema.optional(),
    comment: nullableTrimmedString.optional(),
    nightShift: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const inventoryBookInSchema = z.object({
  partId: positiveIntSchema,
  locationId: positiveIntSchema,
  qty: positiveIntSchema,
  reason: nullableTrimmedString,
  projectId: nullablePositiveIdSchema.optional().default(null),
  performedBy: nullablePositiveIdSchema.optional().default(null),
  notes: nullableTrimmedString,
});

export const inventoryBookOutSchema = z.object({
  partId: positiveIntSchema,
  locationId: positiveIntSchema,
  qty: positiveIntSchema,
  reason: nullableTrimmedString,
  projectId: nullablePositiveIdSchema.optional().default(null),
  performedBy: nullablePositiveIdSchema.optional().default(null),
  notes: nullableTrimmedString,
  shelfQtyRemaining: nonNegativeIntSchema.optional(),
});

export const inventoryAdjustSchema = z.object({
  partId: positiveIntSchema,
  locationId: positiveIntSchema,
  newQty: nonNegativeIntSchema,
  reason: nullableTrimmedString,
  performedBy: nullablePositiveIdSchema.optional().default(null),
  notes: nullableTrimmedString,
});

export const inventoryTransactionsQuerySchema = z.object({
  partId: positiveIntSchema.optional(),
  type: z.enum(["book_in", "book_out", "adjustment"]).optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  limit: nonNegativeIntSchema.max(500).optional().default(100),
});

export const positiveIdParamSchema = z.object({
  id: positiveIntSchema,
});

export function formatZodError(error: z.ZodError) {
  return error.issues.map((issue) => {
    const path = issue.path.length ? issue.path.join(".") : "request";
    return `${path}: ${issue.message}`;
  });
}
