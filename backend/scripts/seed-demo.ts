import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

import { loadConfig } from '../src/config/env.js';
import { createLogger } from '../src/lib/logger.js';
import { createPgDb } from '../src/db/database.js';
import { generateAuditKey } from '../src/lib/crypto.js';
import { grantRole } from '../src/repositories/userRepository.js';

const config = loadConfig();
if (config.nodeEnv === 'production') {
  console.error('Demo data cannot be seeded in a production environment.');
  process.exit(1);
}

const logger = createLogger({ ...config, logLevel: 'info' });
const db = createPgDb(config, logger);

interface DemoAccount {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  city: string;
  area: string;
  role: 'REQUESTER' | 'DONOR' | 'HOSPITAL' | 'ADMIN';
  donorProfile?: {
    bloodGroup: string;
    isAvailable: boolean;
    consentToContact: boolean;
    lat?: number;
    lng?: number;
  };
  hospitalProfile?: {
    hospitalName: string;
    registrationNumber: string;
    contactPerson: string;
    contactPhone: string;
    officialEmail: string;
    city: string;
    area: string;
    address: string;
    status: 'APPROVED' | 'PENDING';
  };
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    email: 'demo-requester@bloodbridge.test',
    fullName: 'Demo Requester (Synthetic)',
    phone: '+919876543210',
    city: 'Pune',
    area: 'Shivajinagar',
    role: 'REQUESTER',
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    email: 'demo-donor-o@bloodbridge.test',
    fullName: 'Demo Donor O+ (Synthetic)',
    phone: '+919876543211',
    city: 'Pune',
    area: 'Kothrud',
    role: 'DONOR',
    donorProfile: {
      bloodGroup: 'O+',
      isAvailable: true,
      consentToContact: true,
      lat: 18.5074,
      lng: 73.8077,
    },
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    email: 'demo-donor-a@bloodbridge.test',
    fullName: 'Demo Donor A+ (Synthetic)',
    phone: '+919876543212',
    city: 'Pune',
    area: 'Hinjawadi',
    role: 'DONOR',
    donorProfile: {
      bloodGroup: 'A+',
      isAvailable: true,
      consentToContact: true,
      lat: 18.5913,
      lng: 73.7389,
    },
  },
  {
    id: '10000000-0000-4000-8000-000000000004',
    email: 'demo-hospital@bloodbridge.test',
    fullName: 'Dr. Synthetic Verifier',
    phone: '+919876543213',
    city: 'Pune',
    area: 'Camp',
    role: 'HOSPITAL',
    hospitalProfile: {
      hospitalName: 'Pune General Care Hospital (Demo)',
      registrationNumber: 'DEMO-HOSP-001',
      contactPerson: 'Dr. Synthetic Verifier',
      contactPhone: '+919876543213',
      officialEmail: 'demo-hospital@bloodbridge.test',
      city: 'Pune',
      area: 'Camp',
      address: '42 Health Boulevard, Camp, Pune',
      status: 'APPROVED',
    },
  },
  {
    id: '10000000-0000-4000-8000-000000000005',
    email: 'demo-admin@bloodbridge.test',
    fullName: 'Demo Administrator (Synthetic)',
    phone: '+919876543214',
    city: 'Pune',
    area: 'Central',
    role: 'ADMIN',
  },
];

async function seed(): Promise<void> {
  console.log('--- BloodBridge Synthetic Demo Data Seeder ---');
  console.log('Seeding synthetic demonstration accounts and emergency requests...');

  for (const acc of DEMO_ACCOUNTS) {
    // Upsert auth.users record if table exists
    await db.query(
      `insert into auth.users (id, email, raw_user_meta_data)
       values ($1, $2, $3::jsonb)
       on conflict (id) do update set email = excluded.email`,
      [
        acc.id,
        acc.email,
        JSON.stringify({ full_name: acc.fullName, account_type: acc.role === 'DONOR' ? 'DONOR' : 'REQUESTER' }),
      ],
    ).catch(() => {
      // In case auth schema is managed differently by hosted Supabase
    });

    // Upsert public.profiles
    await db.query(
      `insert into public.profiles (id, full_name, phone_number, city, area, account_status)
       values ($1, $2, $3, $4, $5, 'ACTIVE')
       on conflict (id) do update set
         full_name = excluded.full_name,
         phone_number = excluded.phone_number,
         city = excluded.city,
         area = excluded.area`,
      [acc.id, acc.fullName, acc.phone, acc.city, acc.area],
    );

    // Grant primary role
    await grantRole(db, acc.id, acc.role, null);

    // Donor profile
    if (acc.donorProfile) {
      await db.query(
        `insert into public.donor_profiles (user_id, blood_group, is_available, consent_to_contact, latitude, longitude)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (user_id) do update set
           blood_group = excluded.blood_group,
           is_available = excluded.is_available,
           consent_to_contact = excluded.consent_to_contact,
           latitude = excluded.latitude,
           longitude = excluded.longitude`,
        [
          acc.id,
          acc.donorProfile.bloodGroup,
          acc.donorProfile.isAvailable,
          acc.donorProfile.consentToContact,
          acc.donorProfile.lat ?? null,
          acc.donorProfile.lng ?? null,
        ],
      );
    }

    // Hospital profile
    if (acc.hospitalProfile) {
      const hp = acc.hospitalProfile;
      const isApproved = hp.status === 'APPROVED';
      await db.query(
        `insert into public.hospital_profiles (
           user_id, hospital_name, registration_number, contact_person,
           contact_phone, official_email, address, city, area,
           verification_status, verified_at, verified_by
         )
         values ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10,
           $11::timestamptz,
           $12::uuid
         )
         on conflict (user_id) do update set
           hospital_name = excluded.hospital_name,
           city = excluded.city,
           address = excluded.address,
           verification_status = excluded.verification_status,
           verified_at = excluded.verified_at,
           verified_by = excluded.verified_by`,
        [
          acc.id,
          hp.hospitalName,
          hp.registrationNumber,
          hp.contactPerson,
          hp.contactPhone,
          hp.officialEmail,
          hp.address,
          hp.city,
          hp.area,
          hp.status,
          isApproved ? new Date().toISOString() : null,
          isApproved ? acc.id : null,
        ],
      );
    }

    console.log(`  [Account] ${acc.email} (${acc.role})`);
  }

  // Seed blood requests
  const requesterId = DEMO_ACCOUNTS[0]!.id;
  const hospitalUserId = DEMO_ACCOUNTS[3]!.id;

  const demoRequests = [
    {
      bloodGroup: 'O+',
      units: 2,
      hospitalName: 'Pune General Care Hospital (Demo)',
      city: 'Pune',
      area: 'Camp',
      lat: 18.5167,
      lng: 73.8767,
      neededHours: 24,
      priority: 'URGENT',
      message: '[DEMO DATA] Urgent blood required for emergency surgical procedure.',
      phone: '+919876543210',
      status: 'UNDER_REVIEW',
    },
    {
      bloodGroup: 'A+',
      units: 1,
      hospitalName: 'City Memorial Blood Center (Demo)',
      city: 'Pune',
      area: 'Kothrud',
      lat: 18.5074,
      lng: 73.8077,
      neededHours: 48,
      priority: 'NORMAL',
      message: '[DEMO DATA] Scheduled replacement blood units needed.',
      phone: '+919876543210',
      status: 'SUBMITTED',
    },
    {
      bloodGroup: 'B+',
      units: 3,
      hospitalName: 'Ruby Medical Institute (Demo)',
      city: 'Pune',
      area: 'Shivajinagar',
      lat: 18.5314,
      lng: 73.8446,
      neededHours: 12,
      priority: 'CRITICAL',
      message: '[DEMO DATA] Critical requirement for acute trauma management.',
      phone: '+919876543210',
      status: 'VERIFIED',
      reviewedBy: hospitalUserId,
      reviewReason: '[DEMO DATA] Institutional verification confirmed by authorized hospital staff.',
    },
  ];

  for (const req of demoRequests) {
    const auditKey = generateAuditKey();
    const neededBy = new Date(Date.now() + req.neededHours * 3600 * 1000).toISOString();
    const reviewedBy = req.reviewedBy ?? null;
    const reviewedAt = reviewedBy ? new Date().toISOString() : null;
    await db.query(
      `insert into public.blood_requests (
         requester_id, blood_group, units_requested, hospital_name, hospital_city, hospital_area,
         hospital_latitude, hospital_longitude, needed_by, priority, public_message,
         requester_contact_phone, contact_share_consent, status, reviewed_by, reviewed_at,
         review_reason, blockchain_audit_key, blockchain_sync_status
       ) values (
         $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz, $10, $11, $12, true, $13,
         $14::uuid,
         $15::timestamptz,
         $16, $17, 'NOT_SCHEDULED'
       )`,
      [
        requesterId,
        req.bloodGroup,
        req.units,
        req.hospitalName,
        req.city,
        req.area,
        req.lat,
        req.lng,
        neededBy,
        req.priority,
        req.message,
        req.phone,
        req.status,
        reviewedBy,
        reviewedAt,
        req.reviewReason ?? null,
        auditKey,
      ],
    );
    console.log(`  [Request] ${req.bloodGroup} (${req.units} units) at ${req.hospitalName} [${req.status}]`);
  }

  console.log('\nSynthetic demonstration data seeded successfully.');
  console.log('Notice: All seeded entries are synthetic demonstration data and not real medical patients.');
}

try {
  await seed();
} catch (error) {
  console.error('Seeding failed:', error);
  process.exitCode = 1;
} finally {
  await db.close();
}
