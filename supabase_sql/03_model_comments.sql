-- Model comments share the existing comments table used by game comments.
-- Run this in the Supabase SQL editor before posting model comments.
alter table public.comments
  add column if not exists model_id text;

create index if not exists comments_model_id_created_at_idx
  on public.comments (model_id, created_at desc)
  where model_id is not null;
