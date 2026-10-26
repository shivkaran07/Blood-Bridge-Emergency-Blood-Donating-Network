import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

/**
 * Generates an opaque, 256-bit audit reference for future blockchain anchoring.
 * The value is random hex only: it never encodes names, phone numbers or any
 * other personal information.
 */
export function generateAuditKey(): string {
  return randomBytes(32).toString('hex');
}

export function generateRequestId(): string {
  return randomUUID();
}

/** Constant-time comparison helper for opaque tokens. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Approximate great-circle distance in kilometres. Used only when both sides
 * have consented to sharing approximate coordinates.
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

/** Rounds coordinates before sending them to a client, if ever needed. */
export function roundCoordinate(value: number, decimals = 3): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function maskName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Donor';
  if (parts.length === 1) return parts[0] ?? 'Donor';
  const first = parts[0] ?? 'Donor';
  const lastInitial = (parts[parts.length - 1] ?? '').charAt(0).toUpperCase();
  return `${first} ${lastInitial}.`;
}
