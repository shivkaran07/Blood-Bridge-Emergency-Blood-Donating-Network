import type { DbTimestamp } from '../types/domain.js';

export function toIso(value: DbTimestamp): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function toIsoOrNull(value: DbTimestamp | null | undefined): string | null {
  return value === null || value === undefined ? null : toIso(value);
}

export function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

export function toNumberOrNull(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function countAsNumber(value: string | number | null | undefined): number {
  return toNumberOrNull(value) ?? 0;
}

export function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}
