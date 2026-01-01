-- Enable real-time updates for team_invites table
ALTER TABLE public.team_invites REPLICA IDENTITY FULL;

-- Add the team_invites table to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_invites;