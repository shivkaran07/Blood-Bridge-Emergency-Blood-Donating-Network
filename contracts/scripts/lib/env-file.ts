import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Updates (or appends) `KEY=value` lines in an env-style file without touching
 * anything else. Only public runtime configuration is ever written here
 * (contract address, chain id, network name); secrets stay operator-managed.
 */
export function upsertEnvValue(filePath: string, entries: [string, string][]): boolean {
  let contents = '';
  try {
    contents = readFileSync(filePath, 'utf8');
  } catch {
    contents = '';
  }

  let updated = false;
  let result = contents;
  for (const [key, value] of entries) {
    const pattern = new RegExp(`^\\s*${key}\\s*=.*$`, 'm');
    if (pattern.test(result)) {
      const replaced = result.replace(pattern, `${key}=${value}`);
      if (replaced !== result) updated = true;
      result = replaced;
    } else {
      result = `${result.replace(/\s*$/, '')}\n# Added by contracts deploy script\n${key}=${value}\n`;
      updated = true;
    }
  }

  if (updated) {
    writeFileSync(filePath, result, 'utf8');
  }
  return updated;
}
