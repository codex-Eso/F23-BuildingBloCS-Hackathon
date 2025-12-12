-- ============================================
-- SMU HACKATHON DATABASE SCHEMA
-- All IDs are bigint (integer) for simplicity
-- Last updated: December 2024
-- ============================================

-- ============================================
-- TABLES
-- ============================================

-- 1. user_details - Main user table linked to Supabase Auth
-- Columns:
--   user_id (bigint, PK, identity) - Internal ID (1, 2, 3, etc.)
--   auth_id (uuid, unique) - Links to auth.users.id
--   username (varchar, unique) - Email
--   name (varchar) - Full name
--   role (varchar) - 'user' or 'admin'
--   points (bigint) - Current points
--   quest_completed (bigint) - Number of completed quests
--   total_points_earned (bigint) - Lifetime points earned
--   created_at (timestamptz)

-- 2. quests - Quest definitions created by admins
-- Columns:
--   id (bigint, PK, identity) - Quest ID (1, 2, 3, etc.)
--   title (text) - Quest title
--   description (text, nullable) - Quest description
--   points (integer) - Points awarded on completion
--   created_by (bigint, nullable) -> user_details.user_id
--   created_at (timestamptz)

-- 3. quest_assignments - Assigns quests to users
-- Columns:
--   id (bigint, PK, identity) - Assignment ID
--   quest_id (bigint) -> quests.id
--   user_id (bigint) -> user_details.user_id
--   assigned_by (bigint, nullable) -> user_details.user_id
--   status (text) - 'assigned', 'in_progress', 'completed', 'approved', 'rejected'
--   assigned_at (timestamptz)
--   completed_at (timestamptz, nullable)

-- 4. community_page - User posts for completed quests
-- Columns:
--   post_id (bigint, PK)
--   user_id (bigint) -> user_details.user_id
--   quest_id (bigint) -> quests.id
--   created_at (date)
--   post_title (varchar)
--   post_caption (varchar, nullable)

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Check if current user is admin (SECURITY DEFINER to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_details 
    WHERE auth_id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- TRIGGER: Auto-create user_details on signup
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_details (auth_id, name, username, role, points, total_points_earned, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    0,
    0,
    NOW()
  )
  ON CONFLICT (auth_id) DO UPDATE SET
    name = COALESCE(EXCLUDED.name, user_details.name),
    role = COALESCE(NEW.raw_user_meta_data->>'role', user_details.role);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- RLS POLICIES
-- ============================================

-- user_details policies
-- - Users can read/update their own details
-- - Admins can read all user details
CREATE POLICY "user_details_select_own" ON public.user_details FOR SELECT USING (auth.uid() = auth_id);
CREATE POLICY "user_details_update_own" ON public.user_details FOR UPDATE USING (auth.uid() = auth_id);
CREATE POLICY "user_details_insert_own" ON public.user_details FOR INSERT WITH CHECK (auth.uid() = auth_id);
CREATE POLICY "user_details_admin_select" ON public.user_details FOR SELECT USING (public.is_admin());

-- quests policies
-- - Anyone authenticated can read quests
-- - Only admins can create/update/delete quests
CREATE POLICY "quests_select_all" ON public.quests FOR SELECT TO authenticated USING (true);
CREATE POLICY "quests_insert_admin" ON public.quests FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "quests_update_admin" ON public.quests FOR UPDATE USING (public.is_admin());
CREATE POLICY "quests_delete_admin" ON public.quests FOR DELETE USING (public.is_admin());

-- quest_assignments policies
-- - Users can read/update their own assignments (using user_details.user_id lookup)
-- - Admins can read/create/update/delete all assignments
CREATE POLICY "assignments_select_own" ON public.quest_assignments
FOR SELECT USING (user_id = (SELECT user_id FROM public.user_details WHERE auth_id = auth.uid()));

CREATE POLICY "assignments_select_admin" ON public.quest_assignments
FOR SELECT USING (public.is_admin());

CREATE POLICY "assignments_insert_admin" ON public.quest_assignments
FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "assignments_update_own" ON public.quest_assignments
FOR UPDATE USING (user_id = (SELECT user_id FROM public.user_details WHERE auth_id = auth.uid()));

CREATE POLICY "assignments_update_admin" ON public.quest_assignments
FOR UPDATE USING (public.is_admin());

CREATE POLICY "assignments_delete_admin" ON public.quest_assignments
FOR DELETE USING (public.is_admin());

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_user_details_auth_id ON public.user_details(auth_id);
CREATE INDEX IF NOT EXISTS idx_user_details_role ON public.user_details(role);
CREATE INDEX IF NOT EXISTS idx_quest_assignments_user_id ON public.quest_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_quest_assignments_quest_id ON public.quest_assignments(quest_id);
CREATE INDEX IF NOT EXISTS idx_quest_assignments_status ON public.quest_assignments(status);

-- ============================================
-- QUEST WORKFLOW
-- ============================================
-- 
-- 1. Admin creates a quest (quests table)
-- 2. Admin assigns quest to student(s) (quest_assignments table)
--    - status = 'assigned'
-- 3. Student completes the quest and submits
--    - status = 'completed'
-- 4. Admin reviews and approves/rejects
--    - status = 'approved' or 'rejected'
-- 5. If approved, student's points are updated in user_details
--
-- Status flow: assigned -> completed -> approved/rejected
-- ============================================

-- ============================================
-- EXAMPLE DATA STRUCTURE
-- ============================================
-- 
-- user_details:
--   user_id=1, username="admin@example.com", role="admin", auth_id=uuid
--   user_id=2, username="student@example.com", role="user", auth_id=uuid
--
-- quests:
--   id=1, title="Complete Tutorial", points=10, created_by=1
--   id=2, title="First Project", points=50, created_by=1
--
-- quest_assignments:
--   id=1, quest_id=1, user_id=2, assigned_by=1, status="assigned"
--   id=2, quest_id=2, user_id=2, assigned_by=1, status="completed"
-- ============================================
