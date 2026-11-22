-- Removing test data. Run in Supabase -> SQL Editor, one step at a time, in order.
--
-- "Test" means: the test logins (emails with +claude, +run1, +run2 or +client), the
-- test businesses (Claude Test Studio, Claude Client Test Studio, Claude
-- Run-through Studio, Launch Test Studio) and everything in them, plus any booking, client, waitlist
-- entry or intake form made with a test email or test client name on any
-- other business. Real accounts (no "+" test email), their settings, Stripe
-- and their real clients are not touched.
--
-- Step 1 lists what will go and changes nothing else. Step 2 copies it all
-- to backup tables. Step 3 deletes it, all or nothing. Step 4 (a few days
-- later) drops the backups.

-- =====================================================================
-- STEP 1: PREVIEW (marks the test rows in a "cleanup_test" schema, then
-- lists them; real tables are not changed)
-- =====================================================================
create schema if not exists cleanup_test;
drop table if exists cleanup_test.logins, cleanup_test.pros, cleanup_test.bookings,
  cleanup_test.clients, cleanup_test.waitlist_entries, cleanup_test.intake_responses;

create table cleanup_test.logins as
  select id, email from auth.users where email ~* '\+(claude|run1|run2|client)@';
create table cleanup_test.pros as
  select id, business_name from public.stylists
  where id in (select id from cleanup_test.logins)
     or business_name ~* '^(claude test studio|claude client test studio|claude run-through studio|launch test studio)$';
create table cleanup_test.bookings as
  select id from public.bookings
  where stylist_id in (select id from cleanup_test.pros)
     or client_email ~* '\+(claude|run1|run2|client)@'
     or client_name ~* '^(run test client|launch test client)$';
create table cleanup_test.clients as
  select id from public.clients
  where stylist_id in (select id from cleanup_test.pros)
     or email ~* '\+(claude|run1|run2|client)@'
     or name ~* '^(run test client|launch test client)$';
create table cleanup_test.waitlist_entries as
  select id from public.waitlist_entries
  where stylist_id in (select id from cleanup_test.pros)
     or user_id in (select id from cleanup_test.logins)
     or coalesce(email, verified_email, '') ~* '\+(claude|run1|run2|client)@';
create table cleanup_test.intake_responses as
  select id from public.intake_responses
  where stylist_id in (select id from cleanup_test.pros)
     or user_id in (select id from cleanup_test.logins)
     or coalesce(email, '') ~* '\+(claude|run1|run2|client)@';

select 'Test logins' as what, count(*) as how_many, string_agg(email, ', ') as details from cleanup_test.logins
union all
select 'Test businesses (and everything in them)', count(*), string_agg(business_name, ', ') from cleanup_test.pros
union all
select 'Bookings (with their deposits, wrap-ups and visit notes)', count(*),
  string_agg(distinct b.status || ' ' || b.booking_date::text, ', ')
  from public.bookings b where b.id in (select id from cleanup_test.bookings)
union all
select '  ...of those, on businesses that are NOT test (check these)', count(*),
  string_agg(distinct s.business_name || ': ' || b.client_name, ', ')
  from public.bookings b join public.stylists s on s.id = b.stylist_id
  where b.id in (select id from cleanup_test.bookings) and b.stylist_id not in (select id from cleanup_test.pros)
union all
select '  ...with a paid deposit (sandbox payments)', count(*), null
  from public.bookings where id in (select id from cleanup_test.bookings) and deposit_status = 'paid'
union all
select 'Clients', count(*), string_agg(distinct c.name, ', ')
  from public.clients c where c.id in (select id from cleanup_test.clients)
union all
select 'Waitlist entries (and their offers/claims)', count(*), null from cleanup_test.waitlist_entries
union all
select 'Intake form answers', count(*), null from cleanup_test.intake_responses
union all
select 'Deposit disputes on test bookings', count(*), null
  from public.deposit_disputes where booking_id in (select id from cleanup_test.bookings);

-- =====================================================================
-- STEP 2: BACKUP (copies every row that step 3 deletes)
-- =====================================================================
drop table if exists cleanup_test.backup_users, cleanup_test.backup_stylists, cleanup_test.backup_bookings,
  cleanup_test.backup_clients, cleanup_test.backup_waitlist_entries, cleanup_test.backup_waitlist_offers,
  cleanup_test.backup_intake_responses, cleanup_test.backup_deposit_disputes;
create table cleanup_test.backup_users as
  select id, email, created_at, raw_user_meta_data from auth.users where id in (select id from cleanup_test.logins);
create table cleanup_test.backup_stylists as
  select * from public.stylists where id in (select id from cleanup_test.pros);
create table cleanup_test.backup_bookings as
  select * from public.bookings where id in (select id from cleanup_test.bookings)
     or stylist_id in (select id from cleanup_test.pros);
create table cleanup_test.backup_clients as
  select * from public.clients where id in (select id from cleanup_test.clients);
create table cleanup_test.backup_waitlist_entries as
  select * from public.waitlist_entries where id in (select id from cleanup_test.waitlist_entries);
create table cleanup_test.backup_waitlist_offers as
  select * from public.waitlist_offers where entry_id in (select id from cleanup_test.waitlist_entries)
     or booking_id in (select id from cleanup_test.bookings);
create table cleanup_test.backup_intake_responses as
  select * from public.intake_responses where id in (select id from cleanup_test.intake_responses);
create table cleanup_test.backup_deposit_disputes as
  select * from public.deposit_disputes where booking_id in (select id from cleanup_test.bookings);
select 'backed up' as done,
  (select count(*) from cleanup_test.backup_bookings) as bookings,
  (select count(*) from cleanup_test.backup_clients) as clients,
  (select count(*) from cleanup_test.backup_stylists) as businesses,
  (select count(*) from cleanup_test.backup_users) as logins;

-- =====================================================================
-- STEP 3: DELETE (all or nothing)
-- =====================================================================
begin;
delete from public.deposit_disputes where booking_id in (select id from cleanup_test.bookings);
delete from public.waitlist_offers where entry_id in (select id from cleanup_test.waitlist_entries)
  or booking_id in (select id from cleanup_test.bookings);
delete from public.waitlist_entries where id in (select id from cleanup_test.waitlist_entries);
delete from public.intake_responses where id in (select id from cleanup_test.intake_responses);
delete from public.bookings where id in (select id from cleanup_test.bookings);
delete from public.clients where id in (select id from cleanup_test.clients);
-- A test business goes with everything in it (services, openings, events, plan...).
delete from public.stylists where id in (select id from cleanup_test.pros);
-- The test logins themselves (and their saved tips, calendar links...).
delete from auth.users where id in (select id from cleanup_test.logins);
commit;
select 'deleted' as done,
  (select count(*) from public.bookings where id in (select id from cleanup_test.bookings)) as bookings_left,
  (select count(*) from auth.users where id in (select id from cleanup_test.logins)) as logins_left;

-- =====================================================================
-- STEP 4 (a few days later, once you're happy): remove the backups
-- =====================================================================
-- drop schema cleanup_test cascade;
