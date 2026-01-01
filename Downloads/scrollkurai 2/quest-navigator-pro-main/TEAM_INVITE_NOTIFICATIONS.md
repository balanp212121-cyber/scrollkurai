# Team Invite Real-Time Notifications

## Feature Overview
Real-time notifications system that alerts team inviters when their team invites are accepted.

## Implementation

### Database
- Enabled real-time updates on `team_invites` table with `REPLICA IDENTITY FULL`
- Added `team_invites` to `supabase_realtime` publication

### Frontend (TeamsPage.tsx)
- Added real-time subscription listening for `team_invites` UPDATE events
- Filters for invites where current user is the inviter (`inviter_id=eq.{user.id}`)
- Detects status changes from 'pending' to 'accepted'
- Fetches team name and invitee username for rich notifications
- Shows toast notification with success message when invite is accepted
- Automatically refreshes teams and invite lists

## How It Works

1. **User A** creates a team and invites **User B**
2. **User A's** page subscribes to real-time updates for team_invites where they are the inviter
3. **User B** accepts the invite
4. Database updates `team_invites` row: status='accepted'
5. **User A** receives real-time notification via WebSocket
6. **User A** sees toast: "**{User B}** accepted your invite to **{Team Name}**! 🎉"
7. Team lists automatically refresh to show new member

## Testing

### Manual Test Steps
1. **Setup**: Open app in two browser windows (User A and User B)
2. **User A**: Create a team and invite User B
3. **User B**: Navigate to /teams and see the invite
4. **User B**: Click invite and accept it
5. **Expected**: User A immediately sees a toast notification:
   - Message: "{User B's username} accepted your invite to {Team Name}!"
   - Description: "Your team just got stronger! 🎉"
   - Duration: 5 seconds
6. **Expected**: User A's team list auto-updates showing User B as member

### Edge Cases Handled
- User not authenticated: Subscription doesn't start
- Multiple invite acceptances: Each triggers separate notification
- Team/profile not found: Notification won't show (graceful failure)
- Page navigation: Subscription cleans up properly

## Files Changed
- `src/pages/Teams/TeamsPage.tsx` - Added real-time subscription with useEffect hook
- Database migration - Enabled real-time for team_invites table

## Benefits
- **Instant feedback**: Inviters know immediately when someone joins
- **Engagement**: Creates sense of connection and team building
- **No refresh needed**: Real-time updates keep UI in sync
- **Scalable**: Uses Supabase real-time (WebSocket) infrastructure

## Future Enhancements (Optional)
- Store notifications in database for persistent notification history
- Add notification center/bell icon with notification list
- Email notifications for offline users
- Notification preferences (enable/disable team invite notifications)
- Sound effects or visual animations for notifications
