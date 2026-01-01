-- Enable real-time updates for team_members table
ALTER TABLE public.team_members REPLICA IDENTITY FULL;

-- Add the team_members table to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;