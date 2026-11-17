-- ============================================================================
-- DUNIA BAHASA BLOCKVERSE — SKRIP PANGKALAN DATA SUPABASE (POSTGRES + RLS)
-- Selamat dijalankan berulang kali (idempoten) di Supabase Dashboard -> SQL Editor
-- ============================================================================

-- 1. Jadual Profil Pengguna (Guru & Murid + Avatar 3D)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null check (role in ('guru', 'murid')),
  teacher_code text,
  avatar jsonb not null default '{}'::jsonb,
  badges text[] not null default array['avatar_pereka'],
  total_stars integer not null default 10,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Pengguna boleh baca profil sendiri" on public.profiles;
create policy "Pengguna boleh baca profil sendiri"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Pengguna boleh cipta profil sendiri" on public.profiles;
create policy "Pengguna boleh cipta profil sendiri"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Pengguna boleh kemas kini profil sendiri tanpa ubah peranan" on public.profiles;
create policy "Pengguna boleh kemas kini profil sendiri tanpa ubah peranan"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 2. Jadual Dunia 3D (Blok, Bangunan, NPC, Stesen Bahasa, Zon Muzik, Pemulihan)
create table if not exists public.worlds (
  id text primary key,
  world_code text unique not null,
  title text not null,
  description text not null default '',
  world_type text not null check (world_type in ('kampung', 'hutan', 'istana', 'kreatif')),
  owner_id uuid references auth.users(id) on delete set null,
  owner_name text not null default 'Guru Blockverse',
  teacher_code text not null default 'GURU-0001',
  is_published boolean not null default true,
  allow_student_build boolean not null default false,
  max_players integer not null default 25,
  day_time_mode text not null default 'siang',
  blocks jsonb not null default '[]'::jsonb,
  structures jsonb not null default '[]'::jsonb,
  npcs jsonb not null default '[]'::jsonb,
  stations jsonb not null default '[]'::jsonb,
  music_zones jsonb not null default '[]'::jsonb,
  signs jsonb not null default '[]'::jsonb,
  custom_uniforms jsonb not null default '[]'::jsonb,
  snapshots jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.worlds enable row level security;

drop policy if exists "Baca dunia diterbitkan atau dunia milik guru sendiri" on public.worlds;
create policy "Baca dunia diterbitkan atau dunia milik guru sendiri"
  on public.worlds for select
  using (is_published = true or auth.uid() = owner_id);

drop policy if exists "Hanya guru boleh cipta dunia baharu" on public.worlds;
create policy "Hanya guru boleh cipta dunia baharu"
  on public.worlds for insert
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'guru'
    )
  );

drop policy if exists "Hanya guru pemilik boleh sunting dunia" on public.worlds;
create policy "Hanya guru pemilik boleh sunting dunia"
  on public.worlds for update
  using (
    auth.uid() = owner_id
    or (
      owner_id is null
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'guru'
      )
    )
  );

drop policy if exists "Hanya guru pemilik boleh padam dunia" on public.worlds;
create policy "Hanya guru pemilik boleh padam dunia"
  on public.worlds for delete
  using (auth.uid() = owner_id);

-- Fungsi selamat untuk murid menyumbang blok hanya jika guru mengaktifkan allow_student_build
create or replace function public.update_student_blocks(p_world_id text, p_blocks jsonb)
returns public.worlds
language plpgsql
security definer
as $$
declare
  v_world public.worlds;
begin
  if auth.uid() is null then
    raise exception 'Sila log masuk terlebih dahulu.';
  end if;

  select * into v_world from public.worlds where id = p_world_id;
  if not found then
    raise exception 'Dunia tidak dijumpai.';
  end if;

  if v_world.allow_student_build is not true and v_world.owner_id <> auth.uid() then
    raise exception 'Guru tidak mengaktifkan mod membina untuk murid di dunia ini.';
  end if;

  update public.worlds
  set blocks = p_blocks,
      version = version + 1,
      updated_at = now()
  where id = p_world_id
  returning * into v_world;

  return v_world;
end;
$$;

-- 3. Jadual Templat Binaan Guru
create table if not exists public.templates (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null default 'Binaan Guru',
  blocks jsonb not null default '[]'::jsonb,
  structures jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.templates enable row level security;

drop policy if exists "Guru urus templat sendiri" on public.templates;
create policy "Guru urus templat sendiri"
  on public.templates for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- 4. Jadual Rekod Kemajuan Murid (Analitik Dashboard Guru)
create table if not exists public.student_progress (
  id text primary key,
  student_id uuid not null references auth.users(id) on delete cascade,
  student_name text not null,
  avatar_summary jsonb not null default '{}'::jsonb,
  world_id text not null references public.worlds(id) on delete cascade,
  world_code text not null,
  world_title text not null,
  station_id text not null,
  station_title text not null,
  expression text not null,
  category text not null,
  score integer not null default 0,
  max_score integer not null default 20,
  attempts integer not null default 1,
  wrong_attempts integer not null default 0,
  completed boolean not null default false,
  mastery_level text not null default 'Dalam Latihan',
  time_spent_seconds integer not null default 0,
  unmastered_questions jsonb not null default '[]'::jsonb,
  history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique (student_id, world_id, station_id)
);

alter table public.student_progress enable row level security;

drop policy if exists "Murid baca rekod sendiri dan guru baca rekod dunia miliknya sahaja" on public.student_progress;
create policy "Murid baca rekod sendiri dan guru baca rekod dunia miliknya sahaja"
  on public.student_progress for select
  using (
    auth.uid() = student_id
    or exists (
      select 1 from public.worlds w
      where w.id = student_progress.world_id
        and w.owner_id = auth.uid()
    )
  );

drop policy if exists "Murid simpan rekod sendiri" on public.student_progress;
create policy "Murid simpan rekod sendiri"
  on public.student_progress for insert
  with check (auth.uid() = student_id);

drop policy if exists "Murid kemas kini rekod sendiri" on public.student_progress;
create policy "Murid kemas kini rekod sendiri"
  on public.student_progress for update
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

-- 5. Storage Bucket untuk Fail Lagu MP3, Audio, Gambar & PDF Guru
insert into storage.buckets (id, name, public)
values ('blockverse-media', 'blockverse-media', true)
on conflict (id) do nothing;

drop policy if exists "Akses awam baca media Blockverse" on storage.objects;
create policy "Akses awam baca media Blockverse"
  on storage.objects for select
  using (bucket_id = 'blockverse-media');

drop policy if exists "Hanya guru log masuk boleh muat naik media" on storage.objects;
create policy "Hanya guru log masuk boleh muat naik media"
  on storage.objects for insert
  with check (
    bucket_id = 'blockverse-media'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'guru'
    )
  );
