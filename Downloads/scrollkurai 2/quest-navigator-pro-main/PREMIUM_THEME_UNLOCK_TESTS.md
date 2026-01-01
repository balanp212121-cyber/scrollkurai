# Premium Theme Unlock - Smoke Tests

## Test Scenario: User purchases ScrollKurai Pro and themes unlock immediately

### Pre-requisites
1. User is logged in
2. User has pending payment proof for Premium purchase
3. Admin is logged in with admin privileges

### Test Steps

#### 1. Purchase Approval → Entitlement Activation
- [ ] Admin navigates to `/admin` → "Payment Proofs" tab
- [ ] Admin clicks "Approve Payment" for user's premium purchase
- [ ] Verify payment status changes from `pending` → `approved`
- [ ] Verify `profiles.premium_status` is set to `true` for user
- [ ] Verify `subscriptions` record is created with `status: 'active'` and `expires_at` (30 days from now)
- [ ] Verify audit log entry is created in `payment_proof_audit` table

#### 2. Immediate UI Refresh (No Logout Required)
- [ ] User is on `/profile` page (has ThemeSelector visible)
- [ ] After admin approval, user sees toast: "🎉 ScrollKurai Pro Activated! Premium themes and features are now unlocked"
- [ ] Premium themes automatically unlock in ThemeSelector (no page refresh needed)
- [ ] Lock icons on premium themes disappear
- [ ] User can select and apply premium themes immediately

#### 3. Idempotency Check
- [ ] Admin clicks "Approve Payment" again on same proof
- [ ] Verify toast shows "Already Approved" message
- [ ] Verify no duplicate subscriptions are created
- [ ] Verify no errors occur

#### 4. Subscription Expiry Handling
- [ ] Manually update `subscriptions.expires_at` to past date
- [ ] User navigates to premium page or premium theme selector
- [ ] Verify premium features are locked again
- [ ] Verify themes show lock icons
- [ ] Verify `PremiumRouteGuard` blocks access with "Premium Feature" message

#### 5. Server-Side Authorization
- [ ] Verify `PremiumRouteGuard` checks both:
  - `profiles.premium_status = true`
  - Valid subscription with `status = 'active'` and `expires_at > now()`
- [ ] Verify RLS policies on `user_theme_selection` table prevent non-premium users from inserting premium theme selections

### Expected Results
✅ Purchase approval instantly activates premium entitlements  
✅ User receives immediate in-app notification  
✅ UI updates in real-time without logout/refresh  
✅ Idempotency prevents duplicate activations  
✅ Subscription expiry properly locks features  
✅ Server-side checks remain authoritative  

### Verification Queries

**Check user's premium status:**
```sql
SELECT id, username, premium_status 
FROM profiles 
WHERE id = '<user_id>';
```

**Check active subscriptions:**
```sql
SELECT user_id, tier, status, started_at, expires_at 
FROM subscriptions 
WHERE user_id = '<user_id>' AND status = 'active';
```

**Check payment proof approval:**
```sql
SELECT pp.id, pp.status, pp.reviewed_at, pp.reviewed_by, pt.item_name, pt.status as transaction_status
FROM payment_proofs pp
JOIN payment_transactions pt ON pt.id = pp.transaction_id
WHERE pp.user_id = '<user_id>';
```

**Check audit trail:**
```sql
SELECT proof_id, reviewer_id, action, admin_note, created_at
FROM payment_proof_audit
WHERE proof_id = '<proof_id>'
ORDER BY created_at DESC;
```

## Rollback Plan
If issues occur, admin can:
1. Update `profiles.premium_status` to `false`
2. Update `subscriptions.status` to `'inactive'`
3. Realtime subscription will trigger UI lock immediately
