alter table public.donor_profiles
  drop constraint if exists donor_coords_require_consent;
