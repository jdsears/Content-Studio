-- Content Studio settings store (workspace Publer keys, workspace API key hashes, ...)
-- Only needed when SUPABASE_URL and SUPABASE_SERVICE_KEY are set on Railway.
-- Run once in the Supabase SQL editor.

create table if not exists content_studio_store (
  collection text not null,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);

-- Row level security on with no policies: only the server's service key
-- can read or write this table. The public anon key cannot see it.
alter table content_studio_store enable row level security;
