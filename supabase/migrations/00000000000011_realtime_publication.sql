-- 00000000000011_realtime_publication.sql
-- Bug fix (UI Task 17 end-to-end verification): Supabase Realtime (Postgres
-- Changes) was completely non-functional for this app. `[realtime] enabled =
-- true` in supabase/config.toml only turns on the Realtime *service* -- it does
-- not publish any table's changes to it. No prior migration ever ran `ALTER
-- PUBLICATION supabase_realtime ADD TABLE ...`, so `select * from
-- pg_publication_tables where pubname = 'supabase_realtime'` returned zero rows
-- against the running local instance. useRealtimeMission / useRealtimeMissionList
-- (src/lib/hooks/) both subscribe correctly to `postgres_changes` on `mission`,
-- `mission_event`, and `custody_event` -- but with none of those tables in the
-- publication, Postgres never emits a replication event for them, so no
-- subscriber (dashboard or mission-detail, in one tab or a hundred) can ever
-- receive one. This is exactly the design spec's §5 requirement ("Supabase
-- Realtime (Postgres Changes) on mission, mission_event, custody_event --
-- dashboard and mission-detail subscribe so a state transition made by one tab
-- appears live in another") and the roadmap's "fusion benchmark" (both sides
-- alerted at once) -- verified broken end-to-end before this fix (a second
-- browser session on the same mission never updated after an exception was
-- triggered in the first, no matter how long we waited).

alter publication supabase_realtime add table public.mission;
alter publication supabase_realtime add table public.mission_event;
alter publication supabase_realtime add table public.custody_event;
