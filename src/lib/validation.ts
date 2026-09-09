import { z } from "zod";

// Canadian phone validation: 10 digits, formatted or raw (e.g., 403-123-4567, (403) 123-4567, 4031234567)
const canadianPhoneRegex = /^(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}$/;

export const BookingIntakeSchema = z.object({
  serviceTierId: z.number().int().positive("Please select a valid service tier"),
  clientName: z.string().trim().min(2, "Name must be at least 2 characters"),
  clientEmail: z.string().trim().email("Please enter a valid email address"),
  clientPhone: z
    .string()
    .trim()
    .regex(canadianPhoneRegex, "Please enter a valid Canadian phone number (e.g. 403-555-0199)"),
  clientAddress: z.string().trim().min(5, "Please enter your full address (e.g. 123 Elm St, Calgary)"),
  startTime: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)),
});

export const QuickBlockSchema = z.object({
  startTime: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)),
  endTime: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)),
  reason: z.string().trim().max(255).optional().default("Doctor unavailable"),
}).refine((data) => new Date(data.endTime) > new Date(data.startTime), {
  message: "End time must be strictly after start time",
  path: ["endTime"],
});

export const CancelAppointmentSchema = z.object({
  reason: z.string().trim().min(3, "Mandatory cancellation reason must be at least 3 characters"),
});

export const UpdateTierPriceSchema = z.object({
  tierId: z.number().int().positive(),
  price: z.number().positive("Price must be greater than 0"),
});

export const AvailabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  duration: z.coerce.number().int().min(15).max(180),
});

export type BookingIntakeInput = z.infer<typeof BookingIntakeSchema>;
export type QuickBlockInput = z.infer<typeof QuickBlockSchema>;
export type CancelAppointmentInput = z.infer<typeof CancelAppointmentSchema>;
export type UpdateTierPriceInput = z.infer<typeof UpdateTierPriceSchema>;
