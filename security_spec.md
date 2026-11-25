# DOG MODS Security Specification & Threat Invariants

## 1. Data Invariants

1. **Identity Integrity**: Every `mods/{modId}` creation must set `creatorId == request.auth.uid`, and `creatorId` is immutable on updates.
2. **PII Isolation**: User emails live exclusively in `users/{userId}` (readable only by owner or admin), while public attribution lives in PII-free `creators/{userId}`.
3. **Role Protection**: Standard users cannot self-assign `role: 'admin'` in `users/{userId}` or write to `admins/{userId}` unless verified as the bootstrapped owner (`ngpenh@gmail.com` with `email_verified == true`) or promoted by an existing admin.
4. **Bedrock-Only Format & Version Enforcement**: `mods/{modId}` strictly enforces `fileFormat in ['.mcaddon', '.mcpack', '.mcworld', '.zip']`, `mcVersion` matching `^1\.[0-9]{1,3}(\.[0-9]{1,3}){0,2}$`, and bounded `compatibleVersions` (`1..40` valid Bedrock version strings).
5. **Admin-Controlled Custom Versions**: Only administrators (`isAdmin()`) may add custom `versions/{versionId}` entries beyond the 12 deterministic `1.26+` seed versions, or update/delete versions.
6. **Temporal Integrity**: `createdAt` and `updatedAt` must equal `request.time` on creation, `createdAt` is immutable, and `updatedAt == request.time` on updates.
7. **Public Query Isolation**: Public `list` queries on `mods` are enforced rule-side (`resource.data.status == 'approved'`) so unapproved or rejected mods cannot be scraped by non-owners.

## 2. Dirty Dozen Adversarial Payloads

1. **Identity Spoofing on Mod Create**: `creatorId: "other_user_uid"` when `request.auth.uid == "attacker"`. Expected: `PERMISSION_DENIED`.
2. **Shadow Field Injection on Mod Create**: Including `"isVerifiedByStaff": true` alongside valid mod fields. Expected: `PERMISSION_DENIED`.
3. **Self-Promotion on User Create**: Creating `users/attacker` with `role: "admin"` and `isBanned: false`. Expected: `PERMISSION_DENIED`.
4. **Role Escalation on User Update**: Updating own `users/attacker` with `{ role: "admin" }`. Expected: `PERMISSION_DENIED`.
5. **Unban Self**: Banned user updating own `users/attacker` with `{ isBanned: false }`. Expected: `PERMISSION_DENIED`.
6. **Java `.jar` Injection**: Creating `mods/bad` with `fileFormat: ".jar"`. Expected: `PERMISSION_DENIED`.
7. **Non-Admin Custom Version Injection**: Standard user creating `versions/1_99_0` outside the deterministic seed list. Expected: `PERMISSION_DENIED`.
8. **Admin Email Spoof (`email_verified: false`)**: Request with `token.email == 'ngpenh@gmail.com'` and `token.email_verified == false`. Expected: `PERMISSION_DENIED`.
9. **Resource Exhaustion via Oversized Compatible Versions Array**: Creating `mods/bad` with 500 entries in `compatibleVersions`. Expected: `PERMISSION_DENIED`.
10. **Download Count Tampering**: Setting `downloadCount: 999999` instead of `existing.downloadCount + 1`. Expected: `PERMISSION_DENIED`.
11. **Featured Flag Hijack**: Non-admin creator updating own mod with `isFeatured: true`. Expected: `PERMISSION_DENIED`.
12. **Client Timestamp Forgery**: Creating a mod with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time`. Expected: `PERMISSION_DENIED`.
