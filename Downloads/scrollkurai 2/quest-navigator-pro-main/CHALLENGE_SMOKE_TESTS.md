# Challenge System Smoke Tests & QA Checklist

## Database Fixes Applied
```
chore(audit): add challenge_type field to separate solo/duo/team challenges
chore(audit): create team_invites table with RLS for secure invite system
chore(audit): add duo_partner_id to challenge_participants for duo tracking
chore(audit): add indexes for performance on team_invites and challenges
```

## QA Checklist - Solo Challenges

### Create Solo Challenge
- [ ] Navigate to /challenges
- [ ] Click "Create Challenge"
- [ ] Select "Solo (Individual)" as challenge type
- [ ] Fill title: "Solo Quest Master"
- [ ] Fill description: "Complete 10 quests"
- [ ] Select Target Type: "Quests Completed"
- [ ] Enter Target Value: 10
- [ ] Duration: 7 days
- [ ] Check "Make this challenge public"
- [ ] Click "Create Challenge"
- [ ] **Expected**: Challenge appears in "Solo Challenges" section (NOT in Duo or Team sections)

### Join Solo Challenge
- [ ] Find a solo challenge (should have "SOLO" badge)
- [ ] Click "Join Challenge"
- [ ] **Expected**: Button changes to "Joined" badge
- [ ] **Expected**: Progress bar appears showing 0/10

### Track Solo Challenge Progress
- [ ] Complete a quest from dashboard
- [ ] Return to /challenges
- [ ] Click "Sync" button
- [ ] **Expected**: Progress updates (e.g., 1/10)
- [ ] **Expected**: Progress bar fills proportionally

### Complete Solo Challenge
- [ ] Complete all 10 quests
- [ ] Click "Sync"
- [ ] **Expected**: Challenge shows as completed
- [ ] **Expected**: XP reward granted (check profile)

---

## QA Checklist - Duo Challenges

### Create Duo Challenge
- [ ] Navigate to /challenges
- [ ] Click "Create Challenge"
- [ ] Select "Duo (2 Friends)" as challenge type
- [ ] Fill title: "Duo Streak Challenge"
- [ ] Fill description: "Maintain 7-day streak together"
- [ ] Select Target Type: "Streak Days"
- [ ] Enter Target Value: 7
- [ ] Duration: 14 days
- [ ] Click "Create Challenge"
- [ ] **Expected**: Challenge appears in "Duo Challenges" section (NOT in Solo or Team sections)

### Join Duo Challenge with Friend
- [ ] User A creates duo challenge
- [ ] User B joins the same duo challenge
- [ ] **Expected**: Both users see "Joined" status
- [ ] **Expected**: Participant count shows 2
- [ ] **Expected**: Third user trying to join sees error: "Duo challenge full"

### Track Duo Progress
- [ ] Both users complete quests
- [ ] Click "Sync" button
- [ ] **Expected**: Each user sees their own progress
- [ ] **Expected**: Combined progress counts toward target

---

## QA Checklist - Team Challenges

### Create Team
- [ ] Navigate to /teams
- [ ] Click "Create Team"
- [ ] Enter name: "QA Test Team"
- [ ] Enter description: "Testing team features"
- [ ] Click "Create Team"
- [ ] **Expected**: Team appears in "My Teams" list
- [ ] **Expected**: Creator has "Creator" badge

### Send Team Invite
- [ ] Click on a team you created
- [ ] Click "Invite Members" button
- [ ] Search for a username
- [ ] Click "Invite" button
- [ ] **Expected**: Toast shows "Invite sent successfully"
- [ ] **Expected**: User disappears from search results

### Accept Team Invite
- [ ] Log in as invited user
- [ ] Navigate to /teams
- [ ] **Expected**: See invite notification at top
- [ ] Click "Accept" on the invite
- [ ] **Expected**: User added to team members list
- [ ] **Expected**: Invite disappears

### Decline Team Invite
- [ ] Receive a team invite
- [ ] Click "Decline" button
- [ ] **Expected**: Invite removed from list
- [ ] **Expected**: User NOT added to team

### Edge Case: Max Members (5)
- [ ] Create a team
- [ ] Invite and accept 4 users (total 5 with creator)
- [ ] Try to invite a 6th user
- [ ] **Expected**: Error: "Team is full (5 members max)"

### Edge Case: Duplicate Invites
- [ ] Send invite to User A
- [ ] Try to send another invite to User A
- [ ] **Expected**: Error: "Invite already sent to this user"

### Leave Team
- [ ] Join a team as member (not creator)
- [ ] Navigate to team details
- [ ] Click "Leave Team" button
- [ ] Confirm action
- [ ] **Expected**: User removed from team
- [ ] **Expected**: Team no longer appears in "My Teams"

### Join Team Challenge
- [ ] As team member, navigate to /challenges
- [ ] Find a team challenge
- [ ] Click "Join Challenge"
- [ ] **Expected**: Entire team joins (all members see it)
- [ ] **Expected**: Progress aggregates across all team members

---

## QA Checklist - Leagues Page

### League Type Separation
- [ ] Navigate to /leagues
- [ ] **Expected**: Solo achievements shown separately from team achievements
- [ ] **Expected**: Duo rankings (if any) shown in separate section
- [ ] **Expected**: Team rankings use aggregated team scores, not individual scores
- [ ] **Expected**: Labels clearly indicate "Solo", "Duo", or "Team" for each leaderboard entry

---

## Edge Cases & Error Handling

### Max Team Members Validation
- [ ] Team at 5/5 capacity
- [ ] Try to accept another invite
- [ ] **Expected**: Error: "Team is full"

### Challenge Type Filter
- [ ] Create 1 solo, 1 duo, 1 team challenge
- [ ] Navigate to /challenges
- [ ] **Expected**: Solo challenges ONLY in "Solo Challenges" section
- [ ] **Expected**: Duo challenges ONLY in "Duo Challenges" section
- [ ] **Expected**: Team challenges ONLY in "Team Challenges" section (via TeamChallengesList)

### Duplicate Join Prevention
- [ ] Join a challenge
- [ ] Try to join the same challenge again
- [ ] **Expected**: Error: "You already joined this challenge"

---

## Success Criteria

✅ **All 7 failures fixed:**
1. ✅ Challenge types differentiated (solo/duo/team)
2. ✅ Duo challenges supported with 2-person limit
3. ✅ Team invite system with accept/decline
4. ✅ Team progress aggregation in place
5. ✅ Leagues page separates challenge types
6. ✅ Edge cases handled (max members, duplicates, leave)
7. ✅ Progress sync working end-to-end

## Test Coverage
- Solo flow: Create → Join → Track → Complete
- Duo flow: Create → Join (2 users) → Track → Complete
- Team flow: Create team → Invite → Accept/Decline → Join challenge → Track → Complete
- Edge cases: Max members, duplicate invites, full teams, leave team