import { z } from 'zod';

/**
 * Runtime configuration. Required values are validated at startup so the API
 * fails with a readable message instead of a half-configured server.
 */
export interface RateLimitConfig {
  enabled: boolean;
  windowMs: number;
  max: number;
  writeMax: number;
  requestCreateMax: number;
  responseMax: number;
}

export interface BlockchainConfig {
  enabled: boolean;
  networkName: string;
  chainId: number;
  rpcUrl: string;
  contractAddress: string | null;
}

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  corsOrigins: string[];
  logLevel: string;
  trustProxy: boolean;
  databaseUrl: string;
  databaseSsl: boolean;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  rateLimit: RateLimitConfig;
  blockchain: BlockchainConfig;
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_SSL: z.enum(['true', 'false']).default('true'),

  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(20, 'SUPABASE_SERVICE_ROLE_KEY looks too short')
    .refine((value) => !value.startsWith('VITE_'), 'Never use a VITE_ variable for secrets'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(900_000),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),
  WRITE_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(60),

  BLOCKCHAIN_ENABLED: z.enum(['true', 'false']).default('false'),
  BLOCKCHAIN_NETWORK_NAME: z.string().default('hardhat-local'),
  BLOCKCHAIN_CHAIN_ID: z.coerce.number().int().positive().default(31337),
  BLOCKCHAIN_RPC_URL: z.string().default('http://127.0.0.1:8545'),
  BLOCKCHAIN_CONTRACT_ADDRESS: z.string().default(''),
});

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map(
      (issue) => `  - ${issue.path.join('.')}: ${issue.message}`,
    );
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}\n\nCopy backend/.env.example to backend/.env and fill in the values.`);
  }
  const env = parsed.data;

  const corsOrigins = env.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (corsOrigins.length === 0) {
    throw new Error('CORS_ORIGINS must contain at least one allowed origin.');
  }
  if (env.NODE_ENV === 'production' && corsOrigins.includes('*')) {
    throw new Error('Wildcard CORS is not allowed in production.');
  }
  if (env.SUPABASE_URL.includes('YOUR_PROJECT_REF')) {
    throw new Error('SUPABASE_URL still contains the example placeholder.');
  }
  if (env.SUPABASE_SERVICE_ROLE_KEY.includes('your-service-role-key')) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY still contains the example placeholder.');
  }
  if (env.DATABASE_URL.includes('YOUR_PROJECT_REF') || env.DATABASE_URL.includes('password@db.')) {
    throw new Error('DATABASE_URL still contains example placeholder values.');
  }

  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    corsOrigins,
    logLevel: env.LOG_LEVEL,
    trustProxy: env.TRUST_PROXY === 'true',
    databaseUrl: env.DATABASE_URL,
    databaseSsl: env.DATABASE_SSL === 'true',
    supabaseUrl: env.SUPABASE_URL,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    rateLimit: {
      enabled: env.NODE_ENV !== 'test',
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      writeMax: env.WRITE_RATE_LIMIT_MAX,
      requestCreateMax: 10,
      responseMax: 30,
    },
    blockchain: {
      enabled: env.BLOCKCHAIN_ENABLED === 'true',
      networkName: env.BLOCKCHAIN_NETWORK_NAME,
      chainId: env.BLOCKCHAIN_CHAIN_ID,
      rpcUrl: env.BLOCKCHAIN_RPC_URL,
      contractAddress: env.BLOCKCHAIN_CONTRACT_ADDRESS || null,
    },
  };
}
