# 7Sense Perfumes — Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Default Deny**: Every unmatched path in `/databases/{database}/documents` is denied.
2. **Identity & Privilege Escalation Prevention**: Users creating their own `/users/{userId}` document may only assign `role == 'customer'` unless they are the verified bootstrapped CEO email (`betsmodelandevents@gmail.com`). Users cannot escalate their own `role` on update.
3. **PII Isolation**: Customer records (`/customers`), orders (`/orders`), user profiles (`/users`), and integration configurations (`/integrationSettings`) are never publicly readable. Only verified staff/admin or the owning `ownerUid` may access them.
4. **Immutable Audit Trail**: `/auditLogs` and `/stockMovements` require `ownerUid == request.auth.uid` on create and cannot be mutated or deleted by non-admin users.
5. **Server Timestamp Integrity**: `createdAt` must equal `request.time` on create and remain immutable on update; `updatedAt` must equal `request.time` on create and update.
6. **Strict Key & Size Bounds**: Every collection enforces `keys().hasAll(...)` and `keys().hasOnly(...)` along with explicit `.size()` bounds on all strings and bounded arrays (`variants.size() <= 10`, `items.size() <= 20`, `variations.size() <= 5`, `hashtags.size() <= 15`).

## 2. "Dirty Dozen" Adversarial Test Payloads
1. **Shadow Role Escalation**: `PATCH /users/user123` with `{ role: "ceo" }` by non-admin -> `PERMISSION_DENIED`.
2. **Ghost Field Injection**: `POST /products/prod1` adding `{ isFeaturedHack: true }` -> `PERMISSION_DENIED` (`hasOnly` check).
3. **Email Spoofing**: Token with `email: "betsmodelandevents@gmail.com"` and `email_verified: false` -> `PERMISSION_DENIED`.
4. **PII Blanket Read**: Anonymous or customer user calling `GET /customers/cust1` belonging to another user -> `PERMISSION_DENIED`.
5. **Unscoped List Query**: Non-staff user calling `LIST /orders` without matching `ownerUid` -> `PERMISSION_DENIED`.
6. **ID Poisoning**: Document ID > 128 chars or containing invalid characters (`../../etc`) -> `PERMISSION_DENIED` (`isValidId`).
7. **Timestamp Forgery**: `POST /orders/ord1` with backdated client `createdAt` != `request.time` -> `PERMISSION_DENIED`.
8. **Immutable Field Tampering**: `PATCH /orders/ord1` modifying `createdAt` or `ownerUid` -> `PERMISSION_DENIED`.
9. **Array Exhaustion**: `POST /orders/ord1` with 25 items (> 20 limit) -> `PERMISSION_DENIED`.
10. **String Exhaustion**: `POST /customers/cust1` with 50KB `notes` field -> `PERMISSION_DENIED`.
11. **Terminal Order Tampering**: Non-admin attempting to edit `status: "Delivered"` order -> `PERMISSION_DENIED`.
12. **Integration Credential Tampering**: Non-admin attempting `WRITE /integrationSettings/whatsapp` -> `PERMISSION_DENIED`.
