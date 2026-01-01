# Weekly Tournaments / Leagues Feature

## Overview
Duolingo-style league system with 5 tiers: Bronze → Silver → Gold → Platinum → Diamond.

## Data Model

### Tables

#### `leagues`
Stores league tier definitions and XP multipliers
- `tier`: Enum (bronze, silver, gold, platinum, diamond)
- `name`: Display name
- `xp_multiplier`: XP boost for tier (Bronze: 1.0x, Silver: 1.1x, Gold: 1.2x, Platinum: 1.3x, Diamond: 1.5x)

#### `user_leagues`
Tracks each user's current league membership
- `user_id`: User reference
- `league_tier`: Current tier
- `joined_at`, `updated_at`: Timestamps

#### `league_weeks`
Defines weekly competition periods
- `week_start`, `week_end`: Week boundaries (Monday-Monday)
- `processed`: Whether week has been calculated
- `processed_at`: Processing timestamp

#### `league_participations`
Weekly participation and ranking data
- `user_id`, `league_tier`, `week_id`: Participation key
- `xp_earned`: Total XP earned that week
- `rank`: Final rank in league
- `promoted`, `demoted`: Movement flags
- `badge_awarded`: League champion badge reference

### Database Functions

#### `get_current_league_week()`
Returns current week UUID, creates if doesn't exist

#### `get_league_leaderboard(league_tier, week_id?)`
Returns ranked leaderboard for a specific tier and week

## Edge Functions

### `track-league-participation` (JWT required)
**Called on**: Every quest completion
**Purpose**: Updates user's weekly XP total and league participation

**Logic**:
1. Gets or creates user's league membership (defaults to Bronze)
2. Gets current week
3. Upserts participation record with current XP total

### `process-league-week` (Public, cron-triggered)
**Called on**: Every Monday at 00:00 UTC (weekly)
**Purpose**: Calculates rankings, promotes/demotes users, awards badges

**Logic**:
1. Finds last unprocessed week
2. Groups all participations by tier
3. Ranks users within each tier by XP
4. **Top 10**: Promote to next tier + award league champion badge
5. **Bottom 5**: Demote to previous tier
6. Updates `user_leagues` table with new tiers
7. Awards badges to top performers
8. Marks week as processed

## Weekly Cron Setup

To enable automatic weekly resets, run this SQL in Lovable Cloud backend:

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule weekly processing every Monday at 00:00 UTC
SELECT cron.schedule(
  'process-league-week',
  '0 0 * * 1', -- Every Monday at midnight
  $$
  SELECT net.http_post(
    url := 'https://eldzmgtlgphjgwprtwfa.supabase.co/functions/v1/process-league-week',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsZHptZ3RsZ3Boamd3cHJ0d2ZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzkxNDYsImV4cCI6MjA3NTA1NTE0Nn0.gXa1ENFu5MTNdDGu9iRIrrXz2TmWsvfZ8NN3853GaCM"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

### Verify Cron Job
```sql
-- Check if cron job is scheduled
SELECT * FROM cron.job WHERE jobname = 'process-league-week';

-- Check cron execution history
SELECT * FROM cron.job_run_details WHERE jobid = (
  SELECT jobid FROM cron.job WHERE jobname = 'process-league-week'
)
ORDER BY start_time DESC
LIMIT 10;
```

### Manual Trigger (for testing)
```bash
curl -X POST \
  https://eldzmgtlgphjgwprtwfa.supabase.co/functions/v1/process-league-week \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

## UI Components

### `LeagueBanner`
Displays user's current league tier and rank at top of dashboard/leagues page

### `LeagueLeaderboard`
Tabbed interface showing rankings for all 5 tiers with promotion/demotion indicators

### `LeaguesPage`
Main leagues page at `/leagues` route

## Movement Rules

### Promotion (Top 10)
- Move up one tier (Bronze → Silver → Gold → Platinum → Diamond)
- Diamond users stay in Diamond
- Receive tier-specific champion badge

### Demotion (Bottom 5)
- Move down one tier
- Bronze users stay in Bronze

### Stay (Middle ranks)
- Remain in current tier

## Badge Rewards

League champion badges are awarded to top 10 performers:
- 🥉 Bronze Champion
- 🥈 Silver Champion  
- 🥇 Gold Champion
- 💎 Platinum Champion
- 👑 Diamond Champion

## Success Metrics

Track weekly active participation with events:
- `league_participation_tracked`: When user completes quest and joins weekly competition
- `league_week_processed`: When weekly reset runs
- `league_promotion`: User moves up a tier
- `league_demotion`: User moves down a tier
- `league_badge_awarded`: User receives champion badge

**Target**: 40%+ Weekly Active User (WAU) participation rate

## Verification Steps

1. **Check user has league membership**:
```sql
SELECT * FROM user_leagues WHERE user_id = 'USER_ID';
```

2. **Check current week participation**:
```sql
SELECT * FROM league_participations 
WHERE user_id = 'USER_ID' 
  AND week_id = (SELECT get_current_league_week());
```

3. **View leaderboard**:
```sql
SELECT * FROM get_league_leaderboard('bronze');
```

4. **Test weekly processing**:
```bash
curl -X POST https://eldzmgtlgphjgwprtwfa.supabase.co/functions/v1/process-league-week
```

5. **Check processing results**:
```sql
SELECT * FROM league_weeks ORDER BY week_start DESC LIMIT 5;
SELECT * FROM league_participations WHERE promoted = true OR demoted = true;
```

## Backward Compatibility

- All changes are additive (new tables, functions, components)
- Existing features remain unchanged
- Quest completion flow extended with optional league tracking
- No breaking changes to existing APIs or UI

## Testing Checklist

- [ ] User joins Bronze league on first quest completion
- [ ] Weekly XP totals update correctly
- [ ] Leaderboard displays all tiers correctly
- [ ] Top 10 users get promoted and receive badges
- [ ] Bottom 5 users get demoted
- [ ] Middle users stay in tier
- [ ] Edge cases: Diamond promotion (stays), Bronze demotion (stays)
- [ ] Cron job runs weekly and processes correctly
- [ ] UI displays current league and rank accurately
