# Payment Proof Review System

## Overview
Manual payment proof review system implemented with secure file uploads, admin approval workflow, and feature gating based on approval status.

## User Flow
1. User purchases premium/power-up via UPI/QR payment
2. Transaction created with `status: 'pending_review'`
3. User uploads payment screenshot/document (max 5 files, 10MB each)
4. Admin reviews and approves/rejects with optional note
5. On approval: Premium features activated + badges awarded + notifications sent
6. On rejection: User notified with admin note, can re-upload

## Admin Workflow
- Access via `/admin` → "Payment Proofs" tab
- View pending proofs with user info, amount, item details
- View/download proof files via signed URLs
- Approve/reject with admin notes
- Audit trail logged for all actions

## Feature Gating
- `enable_manual_payment_review` flag controls entire flow
- When enabled: Payments require proof upload + admin approval
- When disabled: Instant activation (old flow)
- Premium route guard checks approved proofs in manual review mode

## Security
- Storage bucket `payment-proofs` (private, 10MB limit)
- RLS policies: users see own proofs, admins see all
- Audit logs track all review actions
- File access via signed URLs (5min expiry)

## Test Steps
1. Enable feature flag (already true)
2. Make premium purchase → upload proof
3. Admin approves → instant premium activation
4. User receives notification + premium access
