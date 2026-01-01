# End-to-End Verification Runbook

## ✅ FIXES APPLIED (9 Critical)

1. **Scheduled Jobs**: pg_cron enabled, weekly league job runs Mondays 00:01
2. **Team Size Enforcement**: Database trigger prevents >5 members
3. **Duo Partner Selection**: UI added to CreateChallengeDialog with search
4. **Team Progress Aggregation**: Edge function sums all team member stats
5. **Auto-Sync Progress**: Challenges update automatically after quest completion
6. **Premium Subscriptions**: Payment creates subscription + updates profile.premium_status
7. **Premium Route Guards**: PremiumRouteGuard protects /premium/chatbot and /premium/courses
8. **Onboarding Persistence**: Verified DB write before redirect (500ms delay + retry)
9. **Payment Flow**: Premium purchases now create subscription records

## QA Checklist

### Database
```sql
-- Verify cron job scheduled
SELECT * FROM cron.job;

-- Test team size constraint
-- Try inserting 6th member (should fail)
```

### Frontend Flows
- [ ] Create duo challenge → prompts for partner selection
- [ ] Complete quest → challenge progress syncs automatically
- [ ] Team progress shows aggregated total
- [ ] Premium purchase → subscription record created
- [ ] Access /premium/chatbot without premium → blocked
- [ ] Complete onboarding → check `completed_at` IS NOT NULL
- [ ] Invite 6th team member → error "max members exceeded"

## Files Changed
- 2 migrations, 8 components, 1 edge function

## Commit Messages
```
chore(cron): enable pg_cron and schedule weekly league job
fix(teams): enforce max 5 members via database trigger
fix(challenges): add duo partner selection with user search
feat(challenges): aggregate team progress in edge function
fix(challenges): auto-sync progress after quest completion
feat(payments): create subscription on premium purchase
feat(premium): add PremiumRouteGuard for access control
fix(premium): protect chatbot and courses routes
fix(onboarding): verify persistence before redirect
```
