import { z } from 'zod';
import {
  BLOOD_GROUPS,
  HOSPITAL_VERIFICATION_STATUSES,
  PRIORITIES,
  REQUEST_STATUSES,
} from '../types/domain.js';

const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9\s\-()]{6,19}$/, 'Enter a valid phone number (7-20 digits, optional +).');

const nonEmptyText = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be at most ${max} characters.`);

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters.`)
    .optional()
    .nullable()
    .transform((value) => (value && value.length > 0 ? value : null));

const isoDate = z
  .string()
  .trim()
  .min(1, 'A date and time is required.')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Enter a valid date and time.');

const latitude = z
  .number()
  .min(-90, 'Latitude must be between -90 and 90.')
  .max(90, 'Latitude must be between -90 and 90.');
const longitude = z
  .number()
  .min(-180, 'Longitude must be between -180 and 180.')
  .max(180, 'Longitude must be between -180 and 180.');

const coordinatesSchema = z
  .object({
    latitude: latitude.optional().nullable(),
    longitude: longitude.optional().nullable(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasLat = value.latitude !== undefined && value.latitude !== null;
    const hasLng = value.longitude !== undefined && value.longitude !== null;
    if (hasLat !== hasLng) {
      ctx.addIssue({
        code: 'custom',
        message: 'Provide both latitude and longitude, or neither.',
        path: hasLat ? ['longitude'] : ['latitude'],
      });
    }
  })
  .transform((value) => ({
    latitude: value.latitude ?? null,
    longitude: value.longitude ?? null,
  }));

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});

export const idParamSchema = z.object({ id: z.string().uuid('Invalid identifier') });

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------
export const updateProfileSchema = z
  .object({
    fullName: nonEmptyText('Full name', 2, 120),
    phoneNumber: phone,
    city: nonEmptyText('City', 2, 100),
    area: nonEmptyText('Area', 2, 120),
    postalCode: optionalText(16, 'Postal code'),
  })
  .strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ---------------------------------------------------------------------------
// Donor profile
// ---------------------------------------------------------------------------
export const donorProfileSchema = z
  .object({
    bloodGroup: z.enum(BLOOD_GROUPS),
    isAvailable: z.boolean(),
    consentToContact: z.boolean(),
    latitude: latitude.optional().nullable(),
    longitude: longitude.optional().nullable(),
    privacyAccepted: z.boolean().default(false),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasLat = value.latitude !== undefined && value.latitude !== null;
    const hasLng = value.longitude !== undefined && value.longitude !== null;
    if (hasLat !== hasLng) {
      ctx.addIssue({
        code: 'custom',
        message: 'Provide both latitude and longitude, or neither.',
        path: hasLat ? ['longitude'] : ['latitude'],
      });
    }
    if ((hasLat || hasLng) && !value.consentToContact) {
      ctx.addIssue({
        code: 'custom',
        message: 'Coordinates require consent to be contacted.',
        path: ['consentToContact'],
      });
    }
  })
  .transform((value) => ({
    bloodGroup: value.bloodGroup,
    isAvailable: value.isAvailable,
    consentToContact: value.consentToContact,
    latitude: value.latitude ?? null,
    longitude: value.longitude ?? null,
    privacyAccepted: value.privacyAccepted,
  }));

export const availabilitySchema = z.object({ isAvailable: z.boolean() }).strict();

// ---------------------------------------------------------------------------
// Blood requests
// ---------------------------------------------------------------------------
export const createRequestSchema = z
  .object({
    bloodGroup: z.enum(BLOOD_GROUPS),
    unitsRequested: z.coerce
      .number()
      .int('Units must be a whole number.')
      .min(1, 'Request at least 1 unit.')
      .max(20, 'This prototype accepts at most 20 units per request.'),
    hospitalName: nonEmptyText('Hospital name', 2, 160),
    hospitalCity: nonEmptyText('Hospital city', 2, 100),
    hospitalArea: nonEmptyText('Hospital area', 2, 120),
    neededBy: isoDate,
    priority: z.enum(PRIORITIES),
    publicMessage: optionalText(500, 'Message'),
    contactPhone: phone,
    contactShareConsent: z.literal(true, {
      error: 'Confirm that the requester contact may be shared with accepted donors.',
    }),
    accuracyConfirmed: z.literal(true, {
      error: 'Confirm that the information is accurate.',
    }),
    latitude: latitude.optional().nullable(),
    longitude: longitude.optional().nullable(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasLat = value.latitude !== undefined && value.latitude !== null;
    const hasLng = value.longitude !== undefined && value.longitude !== null;
    if (hasLat !== hasLng) {
      ctx.addIssue({
        code: 'custom',
        message: 'Provide both hospital coordinates, or neither.',
        path: hasLat ? ['longitude'] : ['latitude'],
      });
    }
    if (Date.parse(value.neededBy) <= Date.now()) {
      ctx.addIssue({
        code: 'custom',
        message: 'The required-by time must be in the future.',
        path: ['neededBy'],
      });
    }
  })
  .transform((value) => ({
    bloodGroup: value.bloodGroup,
    unitsRequested: value.unitsRequested,
    hospitalName: value.hospitalName,
    hospitalCity: value.hospitalCity,
    hospitalArea: value.hospitalArea,
    neededBy: new Date(value.neededBy).toISOString(),
    priority: value.priority,
    publicMessage: value.publicMessage,
    contactPhone: value.contactPhone,
    contactShareConsent: true as const,
    accuracyConfirmed: true as const,
    hospitalLatitude: value.latitude ?? null,
    hospitalLongitude: value.longitude ?? null,
  }));

export const requestListQuerySchema = z.object({
  status: z.enum(REQUEST_STATUSES).optional(),
  ...paginationSchema.shape,
});

export const feedQuerySchema = z.object({
  bloodGroup: z.enum(BLOOD_GROUPS).optional(),
  city: z.string().trim().max(100).optional(),
  ...paginationSchema.shape,
});

export const cancelRequestSchema = z
  .object({
    reason: nonEmptyText('Cancellation reason', 5, 500),
  })
  .strict();

export const completeRequestSchema = z
  .object({
    status: z.enum(['PARTIALLY_FULFILLED', 'FULFILLED']),
    note: optionalText(500, 'Note'),
  })
  .strict();

export const verifyRequestSchema = z
  .object({
    reason: optionalText(500, 'Review note'),
  })
  .strict();

export const rejectRequestSchema = z
  .object({
    reason: nonEmptyText('Rejection reason', 10, 500),
  })
  .strict();

// ---------------------------------------------------------------------------
// Donor responses
// ---------------------------------------------------------------------------
export const responseDecisionSchema = z
  .object({ decision: z.enum(['ACCEPTED', 'DECLINED']) })
  .strict();

export const responseCompleteSchema = z.object({}).strict();

// ---------------------------------------------------------------------------
// Hospital applications
// ---------------------------------------------------------------------------
export const hospitalApplicationSchema = z
  .object({
    hospitalName: nonEmptyText('Hospital name', 2, 160),
    registrationNumber: nonEmptyText('Registration number', 3, 80),
    contactPerson: nonEmptyText('Contact person', 2, 120),
    contactPhone: phone,
    officialEmail: z.string().trim().email('Enter a valid official email address.').max(160),
    address: nonEmptyText('Address', 5, 300),
    city: nonEmptyText('City', 2, 100),
    area: nonEmptyText('Area', 2, 120),
    accuracyConfirmed: z.literal(true, {
      error: 'Confirm that the institutional information is accurate.',
    }),
  })
  .strict();

export const hospitalQueueQuerySchema = z.object({ ...paginationSchema.shape });

export const hospitalAuditQuerySchema = z.object({ ...paginationSchema.shape });

export const hospitalApplicationsQuerySchema = z.object({
  status: z.enum(HOSPITAL_VERIFICATION_STATUSES).optional(),
  ...paginationSchema.shape,
});

export const hospitalDecisionSchema = z
  .object({
    decision: z.enum(['APPROVED', 'REJECTED']),
    reason: optionalText(500, 'Review reason'),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.decision === 'REJECTED' && (!value.reason || value.reason.length < 10)) {
      ctx.addIssue({
        code: 'custom',
        message: 'A rejection reason of at least 10 characters is required.',
        path: ['reason'],
      });
    }
  });

// ---------------------------------------------------------------------------
// Administrator
// ---------------------------------------------------------------------------
export const adminUsersQuerySchema = z.object({
  search: z.string().trim().max(120).default(''),
  ...paginationSchema.shape,
});

export const adminUserStatusSchema = z
  .object({
    status: z.enum(['ACTIVE', 'SUSPENDED']),
    reason: optionalText(500, 'Reason'),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.status === 'SUSPENDED' && (!value.reason || value.reason.length < 10)) {
      ctx.addIssue({
        code: 'custom',
        message: 'A suspension reason of at least 10 characters is required.',
        path: ['reason'],
      });
    }
  });

export const adminRequestsQuerySchema = z.object({
  status: z.enum(REQUEST_STATUSES).optional(),
  bloodGroup: z.enum(BLOOD_GROUPS).optional(),
  priority: z.enum(PRIORITIES).optional(),
  city: z.string().trim().max(100).optional(),
  search: z.string().trim().max(120).default(''),
  ...paginationSchema.shape,
});

export const adminAuditQuerySchema = z.object({
  eventType: z.string().trim().max(80).optional(),
  actorUserId: z.string().uuid().optional(),
  requestId: z.string().uuid().optional(),
  ...paginationSchema.shape,
});

export const adminCancelRequestSchema = z
  .object({ reason: nonEmptyText('Cancellation reason', 10, 500) })
  .strict();

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export const notificationsQuerySchema = z.object({
  unreadOnly: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  ...paginationSchema.shape,
});
