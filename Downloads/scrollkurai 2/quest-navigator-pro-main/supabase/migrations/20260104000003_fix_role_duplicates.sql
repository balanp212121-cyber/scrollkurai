-- Migration to fix duplicate user roles
-- 1. Clean up any remaining duplicates (keeping the oldest assignment)
DELETE FROM user_roles a USING user_roles b
WHERE a.id > b.id
AND a.user_id = b.user_id
AND a.role = b.role;

-- 2. Add unique constraint to prevent future duplicates
ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);

-- 3. Add comment
COMMENT ON CONSTRAINT user_roles_user_id_role_key ON user_roles IS 'Ensures a user can only have a specific role assigned once';
