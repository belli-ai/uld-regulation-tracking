# DG AutoCheck Connect API — Integration Guide

Practical integration reference for a Cargo Management System (CMS) embedding **DG AutoCheck Connect API v1**. Distilled from the official integration instructions (v7.2, Jan 2026) and the Postman collection in this folder.

> Source files: `DG_AutoCheck_Connect_API_Integration_Instructions.md`, `DG AutoCheck Connect API.postman_collection.json`

---

## 1. What This API Does

DG AutoCheck verifies a Dangerous Goods Declaration (DGD) for an air cargo shipment. The CMS:

1. Registers an **Acceptance Check** via REST.
2. Optionally uploads the DGD (PDF or XSDG) up-front.
3. Receives a **single-use URL** and opens it in the user's browser.
4. The user completes the documentation + packaging check inside DG AutoCheck.
5. CMS gets notified via **webhook** when the check completes / passes / fails.
6. CMS pulls the XSDG export and PDF report via REST.

---

## 2. Conventions

- **Protocol:** HTTPS only.
- **Base URL:** subscription-specific. Postman variable `{{domain}}`.
- **Auth header:** `Authorization: Bearer <access_token>` on every API call (lock icon in Postman).
- **Content-Type:** prefer `application/json` for body params (Postman uses `x-www-form-urlencoded` for examples; both supported).
- **HTTP status codes:**
  - `200` success
  - `400` validation failed — body lists each invalid parameter
  - `401` token missing / invalid / expired
  - `403` permission missing **OR** acceptance check no longer in a state that can ever accept the request
  - `404` resource not found
  - `409` correct permissions but acceptance check not yet in the right state — body explains why

---

## 3. Authentication — OAuth 2.0 Client Credentials

### 3.1 Get access credentials

Created in the DG AutoCheck Web Services portal:

- **Key** → `client_id`
- **Secret** → `client_secret` (shown once — store securely)
- **Permissions:**
  - `List` — list existing checks
  - `Read` — read individual checks (higher than List)
  - `Manage` — required for `Create`, `Request URL`, `Import XSDG`, `Scan DGD` (API Integrator license)

### 3.2 Request access token

```http
GET {{domain}}/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id=<KEY>
&client_secret=<SECRET>
```

Response includes `access_token` and `expires_in` (seconds). Tokens are short-lived (~20 min). No refresh tokens — re-request when expired.

### 3.3 Use token

```http
Authorization: Bearer <access_token>
```

---

## 4. Endpoint Reference

All paths are relative to `{{domain}}`. All require `Authorization: Bearer …` unless noted.

### 4.1 Acceptance Checks (read)

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/acceptance-checks?officeId=&acceptanceCheckStatus=&limit=` | List | List checks. Filter by office, status (multi), limit (default 50). Cursor-paginated via `_links`. |
| `GET` | `/api/v1/acceptance-checks/:acceptanceCheckId` | Read | Current state of a check, including users on each phase and sign-off result. |
| `OPTIONS` | `/api/v1/acceptance-checks/:acceptanceCheckId` | Read | Returns `_links` showing only the actions currently legal for this check's state. Use this to drive UI affordances. |

### 4.2 Acceptance Checks (lifecycle — Manage perm + API Integrator license)

| Method | Path | Body | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/v1/acceptance-checks` | `officeIdentifier` (req), `officeName`, `userIdentifier`, `userName` | Create a new check. Returns `acceptanceCheckId`. If `userIdentifier` provided, also returns `requestedUrl`. |
| `POST` | `/api/v1/acceptance-checks/:acceptanceCheckId/request-url` | `userIdentifier` (req), `userName` | Generate a fresh single-use URL for the user. URL expires after **10 minutes**. |
| `PUT` | `/api/v1/acceptance-checks/:acceptanceCheckId/import/xsdg` | XSDG XML (`application/xml`) | Import a validated XSDG. On success, status moves to `awaiting-document-check`. |
| `PUT` | `/api/v1/acceptance-checks/:acceptanceCheckId/scan-dgd/:format` | PDF binary | Upload DGD PDF for OCR. `:format` = `pdf`. Only allowed when status is `awaiting-file`. |

### 4.3 Outputs

| Method | Path | Permission | Returns |
| --- | --- | --- | --- |
| `GET` | `/api/v1/acceptance-checks/:acceptanceCheckId/report/:format` | Read | Acceptance check **report PDF**. `:format` = `pdf`. |
| `GET` | `/api/v1/acceptance-checks/:acceptanceCheckId/export/:format` | Read | DGD export. `:format` = `xsdg` or `dgd` (PDF). |

### 4.4 Resources (uploaded by user during check)

| Method | Path | Returns |
| --- | --- | --- |
| `GET` | `/api/v1/acceptance-checks/:acceptanceCheckId/resources` | List of resources (id, displayName, fileName, contentType, fileSize, downloadUrl). |
| `GET` | `/api/v1/acceptance-checks/:acceptanceCheckId/resources/:resourceIdentifier` | Single resource detail. |
| `GET` | `/api/v1/acceptance-checks/:acceptanceCheckId/resources/:resourceIdentifier/download` | Binary download. |

### 4.5 Office-level imports

| Method | Path | Body | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/v1/xsdg/import/:officeId` | XSDG XML | Import XSDG against an office (creates the AC implicitly). |
| `POST` | `/api/v1/dgd/import/:officeId` | PDF binary | Import DGD PDF against an office. |

### 4.6 Offices

| Method | Path | Returns |
| --- | --- | --- |
| `GET` | `/api/v1/offices` | List of offices in subscription (`id`, `code`, `name`, `identifier`). |

---

## 5. Acceptance Check Status Lifecycle

`acceptanceCheckStatus` values (in roughly chronological order):

```
awaiting-file
  → queued
  → scanning              (PDF OCR running)
  → processing-error      (terminal failure path)
  → import-failure        (terminal failure path)
  → verification-required (PDF OCR done; user must verify)
  → verification-in-progress
  → awaiting-document-check
  → documentation-check-in-progress
  → awaiting-packaging-check
  → packaging-check-in-progress
  → completed
```

Sign-off result (after `completed`), found at `acceptanceCheckSignOff.result`:

```
passed | failed
```

XSDG path skips `verification-*` because XSDG is already validated on import.

---

## 6. Three Onboarding Options

CMS picks one based on what data it has at check-creation time.

### Option 1 — No DGD passed

```
1. POST /api/v1/acceptance-checks            (officeIdentifier; optionally userIdentifier)
2. POST /api/v1/acceptance-checks/:id/request-url   (skip if URL already returned in step 1)
3. Open requestedUrl in browser → user uploads PDF/XSDG inside DG AutoCheck UI
```

### Option 2 — PDF DGD passed

```
1. POST /api/v1/acceptance-checks            (officeIdentifier)
2. PUT  /api/v1/acceptance-checks/:id/scan-dgd/pdf   (PDF body)
3. POST /api/v1/acceptance-checks/:id/request-url    (userIdentifier)
4. Open requestedUrl → user verifies OCR result → completes check
```

### Option 3 — XSDG passed

```
1. POST /api/v1/acceptance-checks            (officeIdentifier)
2. PUT  /api/v1/acceptance-checks/:id/import/xsdg    (XSDG XML body)
3. POST /api/v1/acceptance-checks/:id/request-url    (userIdentifier)
4. Open requestedUrl → user goes straight to document/packaging check
```

### Resume an existing check

```
POST /api/v1/acceptance-checks/:id/request-url   (userIdentifier)
→ open URL; user is dropped at the correct stage automatically
```

---

## 7. Offices & Users

- **Office:** identified by `officeIdentifier` (CMS-owned, immutable per office, case-sensitive). DG AutoCheck creates the office on first use if unknown. `officeName` is optional metadata.
- **User:** identified by `userIdentifier` (CMS-owned, immutable per user). Auto-created on first `request-url` call. Auto-assigned to the office of the check.
- **Required at create:** `officeIdentifier`.
- **Required at request-url:** `userIdentifier`.
- **Privacy:** `userName` does not have to be the real name — any unique identifier acceptable.
- **Single-user mode:** if you don't pass user details, all actions log against the API integrator user — audit trail loses per-user attribution.

---

## 8. Webhooks

Outbound `POST` from DG AutoCheck to a CMS-registered listener URL. Configured in the Web Services portal.

### 8.1 Events (v1)

```
acceptance-check-created
ocr-completed
xsdg-imported
acceptance-check-conflicted
verification-started
verification-completed
documentation-check-started
documentation-check-completed
acceptance-check-completed
acceptance-check-failed
acceptance-check-passed
```

### 8.2 Payload

```json
{
  "attempt": 1,
  "eventLogId": "db82366d-cf94-4816-947f-55935ba21e98",
  "event": "acceptance-check-passed",
  "acceptanceCheckId": "Dwl3r"
}
```

`acceptanceCheckId` is the GUID returned from `Create`. Use it to call any read endpoint for full detail.

### 8.3 Headers

```
X-DGAutoCheck-Signature: <sha256 hex>
X-Timestamp:             <ISO-8601>
```

Up to 4 custom headers can be configured globally or per-webhook (per-webhook overrides global).

### 8.4 Signature verification (recommended)

Algorithm:

```
expected = sha256( verificationToken + rawRequestBody )
match    = constantTimeEquals(expected, request.headers["x-dgautocheck-signature"])
```

- `verificationToken` is shown once when the webhook is created in the portal — same value for every webhook on that account, never rotates automatically.
- Use the **raw, untouched request body** as text — don't JSON-parse and re-stringify.

### 8.5 Retries

5 attempts total with exponential back-off:

| Attempt | Delay after previous |
| --- | --- |
| Initial | — |
| Retry 1 | +1 min |
| Retry 2 | +5 min |
| Retry 3 | +15 min |
| Retry 4 | +60 min |

If all 5 fail (~81 min window), DG AutoCheck emails the failure address registered in Web Services config. After that, recover by polling `GET /api/v1/acceptance-checks/:id` or by inspecting webhook logs in the portal.

---

## 9. Reference Response Shapes

### 9.1 Create — `POST /api/v1/acceptance-checks` (200)

```json
{
  "_links": [
    { "description": "Self",        "method": "GET",  "url": "{{domain}}/api/v1/acceptance-checks/aaaa" },
    { "description": "Scan DGD PDF","method": "PUT",  "url": "{{domain}}/api/v1/acceptance-checks/aaaa/scan-dgd/pdf" },
    { "description": "Request URL", "method": "POST", "url": "{{domain}}/api/v1/acceptance-checks/aaaa/request-url" }
  ],
  "acceptanceCheckId": "aaaa",
  "requestedUrl": null,
  "acceptanceCheckStatus": "awaiting-file"
}
```

### 9.2 Request URL (200)

```json
{
  "_links": [
    { "description": "Self",         "method": "GET", "url": "{{domain}}/api/v1/acceptance-checks/aaaa" },
    { "description": "Scan DGD PDF", "method": "PUT", "url": "{{domain}}/api/v1/acceptance-checks/aaaa/scan-dgd/pdf" }
  ],
  "requestedUrl": "{{domain}}/acceptance-check/access/aaaa"
}
```

### 9.3 Acceptance Check (200, completed)

```json
{
  "acceptanceCheckId": "aaaa",
  "acceptanceCheckStatus": "completed",
  "createdOn": "2018-06-15T07:12:05Z",
  "ownedBy": { "id": "brGL", "name": "Ange Selvester", "identifier": "ApiIdentifier" },
  "airWaybillNumber": "865-12562793",
  "office": { "id": "e39N", "code": "PRS", "name": "Sub1Office1 (Paris)", "identifier": "ApiIdentity" },
  "verification":        { "startedOn": "...", "completedOn": "..." },
  "documentationCheck":  { "user": null, "startedOn": "...", "completedOn": "..." },
  "packagingCheck":      { "user": null, "startedOn": "...", "completedOn": "..." },
  "acceptanceCheckSignOff": {
    "result": "passed",
    "signedOffOn": "2018-06-15T07:16:05Z",
    "user": { "id": "brGL", "name": "Ange Selvester", "identifier": "ApiIdentifier" }
  }
}
```

### 9.4 Resources list (200)

```json
{
  "resources": [
    {
      "resourceId": 1,
      "displayName": "Resource 1",
      "fileName": "Eclectus-300&300.jpg",
      "contentType": "image/jpeg",
      "fileSize": 15226,
      "downloadUrl": "{{domain}}/api/v1/acceptance-checks/OROn/resources/1/download"
    }
  ]
}
```

### 9.5 Validation error (400)

```json
{
  "officeIdentifier": ["officeIdentifier required"]
}
```

---

## 10. HATEOAS — `_links`

Every read endpoint returns a `_links` array describing **only the actions legal in the current state**. For example, after `completed`, only `Self`, `Acceptance Check Report`, and `DGD Export` are present — `Request URL` and `Scan DGD PDF` disappear. Drive your CMS UI off these links rather than hard-coding state machines.

`OPTIONS /api/v1/acceptance-checks/:id` returns the same `_links` set without the rest of the body — cheap state probe.

---

## 11. End-to-End Sequence (PDF flow with webhooks)

```
CMS                          DG AutoCheck                      Browser (user)
 │                                │                                  │
 │ POST /oauth2/token             │                                  │
 ├───────────────────────────────►│                                  │
 │ ◄───────── access_token ───────┤                                  │
 │                                │                                  │
 │ POST /acceptance-checks        │                                  │
 │  (officeIdentifier)            │                                  │
 ├───────────────────────────────►│                                  │
 │ ◄── acceptanceCheckId ─────────┤                                  │
 │                                │                                  │
 │ PUT /…/scan-dgd/pdf  (binary)  │                                  │
 ├───────────────────────────────►│                                  │
 │ ◄── 200 ───────────────────────┤                                  │
 │                                │  (OCR runs)                      │
 │                                │                                  │
 │       Webhook: ocr-completed   │                                  │
 │ ◄──────────────────────────────┤                                  │
 │                                │                                  │
 │ POST /…/request-url            │                                  │
 │  (userIdentifier)              │                                  │
 ├───────────────────────────────►│                                  │
 │ ◄── requestedUrl ──────────────┤                                  │
 │                                │                                  │
 │  redirect user ──────────────────────────────────────────────────►│
 │                                │ ◄─── user verifies + completes ──│
 │                                │                                  │
 │   Webhook: acceptance-check-passed                                │
 │ ◄──────────────────────────────┤                                  │
 │                                │                                  │
 │ GET /…/export/xsdg             │                                  │
 │ GET /…/report/pdf              │                                  │
 ├───────────────────────────────►│                                  │
 │ ◄── files ─────────────────────┤                                  │
```

---

## 12. Implementation Checklist

- [ ] Store `client_id` / `client_secret` in a secret manager.
- [ ] Cache `access_token` until ~30 s before `expires_in`.
- [ ] Persist `acceptanceCheckId` against the local shipment / AWB record.
- [ ] Implement webhook listener:
  - [ ] Verify SHA-256 signature against raw body.
  - [ ] Idempotency on `(eventLogId, attempt)`.
  - [ ] Acknowledge fast (< 1 s) — do follow-up API calls in a background queue.
- [ ] Surface `_links` in CMS UI to drive available actions.
- [ ] On `acceptance-check-passed`/`-failed`/`-completed`: pull the XSDG export and PDF report and persist locally.
- [ ] Treat `403` on a lifecycle endpoint as **terminal** (state can never accept this request again).
- [ ] Treat `409` on a lifecycle endpoint as **retryable later** (state hasn't reached the right stage yet).
- [ ] Map office/user identifiers to CMS-side primary keys (case-sensitive).
- [ ] Single-use URLs expire in 10 minutes — request a fresh one per user session.
- [ ] If webhook delivery fails (5 attempts / 81 min), reconcile via polling `GET /api/v1/acceptance-checks/:id`.

---

## 13. References

- Full Postman docs: <https://documenter.getpostman.com/view/883478/2s935hS7zA#intro>
- Local files in this folder:
  - `DG_AutoCheck_Connect_API_Integration_Instructions.md` (v7.2, January 2026)
  - `DG AutoCheck Connect API.postman_collection.json`
