create table if not exists people (
  id text primary key,
  given_name text not null,
  family_name text not null default '',
  sex text not null default 'unspecified',
  birth_year text not null default '',
  death_year text not null default '',
  notes text not null default '',
  founder boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists unions (
  id text primary key,
  a_id text not null,
  b_id text,
  created_at timestamptz not null default now()
);

create table if not exists union_children (
  union_id text not null,
  child_id text not null,
  position integer not null default 0,
  primary key (union_id, child_id)
);

create index if not exists union_children_child_idx on union_children (child_id);
