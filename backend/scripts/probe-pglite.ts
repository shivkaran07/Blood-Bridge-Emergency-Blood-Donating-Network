import { PGlite } from '@electric-sql/pglite';

const db = await PGlite.create();
await db.exec(`
  create schema if not exists auth;
  create table auth.users (id uuid primary key, email text);
  create role authenticated nologin;
  create role anon nologin;
  create role service_role nologin bypassrls;
  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub','')::uuid
  $$;
  create table public.widgets (id uuid primary key default gen_random_uuid(), owner uuid not null, name text);
  alter table public.widgets enable row level security;
  create policy widgets_select on public.widgets for select to authenticated using (owner = auth.uid());
  grant select on public.widgets to authenticated;
`);
const owner = '11111111-1111-1111-1111-111111111111';
const other = '22222222-2222-2222-2222-222222222222';
await db.query('insert into public.widgets (owner, name) values ($1,$2),($3,$4)', [owner, 'mine', other, 'theirs']);
await db.exec(`set role authenticated; select set_config('request.jwt.claims', '{"sub":"${owner}"}', false);`);
const rows = await db.query('select name from public.widgets');
console.log('visible as owner:', rows.rows);
await db.exec('reset role');
console.log('pglite ok');
