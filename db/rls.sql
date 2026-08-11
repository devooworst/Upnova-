-- ---------------------------------------------------------------------
-- Mavyn — Row Level Security policies (production / Postgres)
--
-- Dev runs on SQLite where RLS does not exist; lib/server/authz.ts
-- enforces the same rules in the app layer. When the datasource moves
-- to Postgres, enable RLS with these policies so the database itself
-- becomes the last line of defense. app.current_user_id is set per
-- request by the API layer (SET LOCAL app.current_user_id = '...').
-- ---------------------------------------------------------------------

-- helper: current authenticated user
-- SELECT current_setting('app.current_user_id', true);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_read ON profiles FOR SELECT
  USING (visibility = 'public' OR user_id = current_setting('app.current_user_id', true));
CREATE POLICY profiles_write ON profiles FOR UPDATE
  USING (user_id = current_setting('app.current_user_id', true));

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY posts_read ON posts FOR SELECT USING (true);
CREATE POLICY posts_insert ON posts FOR INSERT
  WITH CHECK (author_id = current_setting('app.current_user_id', true));
CREATE POLICY posts_modify ON posts FOR UPDATE
  USING (author_id = current_setting('app.current_user_id', true));
CREATE POLICY posts_delete ON posts FOR DELETE
  USING (author_id = current_setting('app.current_user_id', true));

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY messages_read ON messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM conversation_members m
                 WHERE m.conversation_id = messages.conversation_id
                   AND m.user_id = current_setting('app.current_user_id', true)));
CREATE POLICY messages_insert ON messages FOR INSERT
  WITH CHECK (sender_id = current_setting('app.current_user_id', true)
    AND EXISTS (SELECT 1 FROM conversation_members m
                WHERE m.conversation_id = messages.conversation_id
                  AND m.user_id = current_setting('app.current_user_id', true)));

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_own ON notifications FOR ALL
  USING (user_id = current_setting('app.current_user_id', true));

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY projects_parties ON projects FOR SELECT
  USING (client_id = current_setting('app.current_user_id', true)
      OR creator_id = current_setting('app.current_user_id', true));
CREATE POLICY projects_update ON projects FOR UPDATE
  USING (client_id = current_setting('app.current_user_id', true)
      OR creator_id = current_setting('app.current_user_id', true));

ALTER TABLE extension_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY extensions_parties ON extension_requests FOR ALL
  USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = extension_requests.project_id
    AND (p.client_id = current_setting('app.current_user_id', true)
      OR p.creator_id = current_setting('app.current_user_id', true))));

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY applications_read ON applications FOR SELECT
  USING (applicant_id = current_setting('app.current_user_id', true)
    OR EXISTS (SELECT 1 FROM opportunities o WHERE o.id = applications.opportunity_id
               AND o.poster_id = current_setting('app.current_user_id', true)));
CREATE POLICY applications_insert ON applications FOR INSERT
  WITH CHECK (applicant_id = current_setting('app.current_user_id', true));

ALTER TABLE campus_verifications ENABLE ROW LEVEL SECURITY;
-- evidence_ref must never be readable by anyone but the verification
-- service role; users may read only their own verification STATUS.
CREATE POLICY campus_verif_own ON campus_verifications FOR SELECT
  USING (user_id = current_setting('app.current_user_id', true));

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY payments_parties ON payments FOR SELECT
  USING (payer_id = current_setting('app.current_user_id', true)
      OR payee_id = current_setting('app.current_user_id', true));
-- payments are inserted/updated exclusively by the service role driven
-- by Stripe Connect webhooks; no direct user writes.

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
CREATE POLICY services_read ON services FOR SELECT USING (active = true OR owner_id = current_setting('app.current_user_id', true));
CREATE POLICY services_write ON services FOR ALL
  USING (owner_id = current_setting('app.current_user_id', true));

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY bookings_parties ON bookings FOR ALL
  USING (client_id = current_setting('app.current_user_id', true)
      OR provider_id = current_setting('app.current_user_id', true));
