# Security Specification: Personal Blood Glucose Management App

## 1. Data Invariants

1. **Strict Ownership Isolation**: Every `UserSettings` document (`/users/{userId}`) and `GlucoseRecord` subcollection document (`/users/{userId}/glucoseRecords/{recordId}`) belongs strictly to a single verified Firebase Auth user (`request.auth.uid == userId`). No user can read, list, create, update, or delete another user's health data.
2. **Master Gate Integrity**: A `GlucoseRecord` cannot be created unless the parent `/users/{userId}` document exists (`exists(...)`), preventing orphaned subcollection records.
3. **Immutable Identity & Creation Metadata**: `uid` and `createdAt` are immutable once created. `createdAt` and `updatedAt` must match `request.time`.
4. **Canonical Numeric & Enum Bounds**: `valueMmol` must be a valid physiological/meter range (`0.5 <= valueMmol <= 40.0`), `measuredAtMs` must be positive, `context`, `mealLevel`, `exerciseLevel`, and `unit` must match closed enum sets, and `note`/`displayName` must obey strict character caps (`<= 200` and `<= 80`).
5. **Zero Shadow Fields**: Document keys are locked via `keys().hasAll(...)` and `keys().hasOnly(...)` on create, and `affectedKeys().hasOnly(...)` on update.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)

1. **Unauthenticated Read/Write**: Read or write `/users/alice` or `/users/alice/glucoseRecords/rec1` with `auth == null`.
2. **Unverified Email Spoofing**: Write `/users/alice` when `request.auth.token.email_verified == false`.
3. **Cross-User Read (`get`)**: User `bob` attempts `get(/users/alice)` or `get(/users/alice/glucoseRecords/rec1)`.
4. **Cross-User List Scraping (`list`)**: User `bob` attempts `list(/users)` or `list(/users/alice/glucoseRecords)`.
5. **Identity Spoofing on Create**: User `bob` creates `/users/bob/glucoseRecords/rec1` with `uid: "alice"`.
6. **Shadow / Ghost Field Injection**: User `alice` creates `/users/alice/glucoseRecords/rec1` with an extra field `isAdmin: true` or `role: "doctor"`.
7. **Invalid Path Variable / ID Poisoning**: User `alice` writes `/users/alice/glucoseRecords/bad$id..with/chars` or >128-char ID.
8. **Value Poisoning (Out-of-Bounds Glucose)**: User `alice` writes `valueMmol: -5` or `valueMmol: 9999` or `valueMmol: "7.2"` (wrong type).
9. **String Exhaustion / Denial of Wallet**: User `alice` writes a 5,000-character `note` in `glucoseRecords`.
10. **Client-Forged Timestamp**: User `alice` creates a record with `createdAt: new Date('2020-01-01')` instead of `serverTimestamp()` (`request.time`).
11. **Immutable Field Tampering on Update**: User `alice` updates `glucoseRecords/rec1` attempting to alter `uid` or `createdAt`.
12. **Orphaned Subcollection Write**: User `alice` creates `/users/alice/glucoseRecords/rec1` before `/users/alice` exists.

## 3. Test Runner

See `firestore.rules.test.ts` for the automated `@firebase/rules-unit-testing` test suite covering all 12 adversarial payloads.
