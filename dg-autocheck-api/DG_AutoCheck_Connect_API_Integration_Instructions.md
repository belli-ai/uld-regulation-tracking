# DG AutoCheck Connect API — Full Integration

**Document Version:** 7.2
**Date:** January 2026
**Audience:** Cargo Management System (CMS) Integrators / Developers

---

## Table of Contents

1. [Overview](#1-overview)
2. [High-Level Integration Approach](#2-high-level-integration-approach)
3. [How It Works](#3-how-it-works)
4. [API Integrator Process](#4-api-integrator-process)
5. [Initiating a DG AutoCheck Acceptance Check](#5-initiating-a-dg-autocheck-acceptance-check)
6. [When an Acceptance Check is Completed](#6-when-an-acceptance-check-is-completed)
7. [Other Supporting API Endpoints](#7-other-supporting-api-endpoints)
8. [Authentication](#8-authentication)
9. [Offices & Users](#9-offices--users)
10. [Passing DGD Data into DG AutoCheck](#10-passing-dgd-data-into-dg-autocheck)
11. [DG AutoCheck Integration Flow](#11-dg-autocheck-integration-flow)
12. [Create DGD — General Principles](#12-create-dgd--general-principles)
13. [Create DGD — Option 1: No DGD Passed](#13-create-dgd--option-1-no-dgd-passed-from-cms)
14. [Create DGD — Option 2: PDF DGD Passed](#14-create-dgd--option-2-pdf-dgd-passed-from-cms)
15. [Create DGD — Option 3: XSDG Passed](#15-create-dgd--option-3-xsdg-passed-from-cms)
16. [Resume Acceptance Check](#16-resume-acceptance-check)
17. [Webhook Events](#17-webhook-events)
18. [Getting Started](#18-getting-started)
19. [Access Credentials](#19-access-credentials)
20. [Creating an Access Token](#20-creating-an-access-token)
21. [Using the Access Token for API Calls](#21-using-the-access-token-for-api-calls)
22. [Webhook Setup](#22-webhook-setup)
23. [Securing Webhooks with Signature Verification](#23-securing-webhooks-with-signature-verification)
24. [Webhook Example Payload](#24-webhook--example-payload)
25. [Webhook Logs](#25-webhook-logs)
26. [Full API Documentation](#26-full-api-documentation)

---

## 1. Overview

The DG AutoCheck Connect API (Full Integration) allows a Cargo Management System (CMS) to drive the entire Dangerous Goods Declaration (DGD) acceptance check process programmatically. Acceptance staff interact with the CMS, and the CMS delegates the DGD verification, documentation check, and packaging check to DG AutoCheck via API calls plus a single browser session.

---

## 2. High-Level Integration Approach

The integration covers the following stages:

- **Authentication & Authorization** — CMS authenticates against DG AutoCheck using OAuth 2.0.
- **Documentation** — DGD documentation is registered in DG AutoCheck via API.
- **Physical Acceptance** — User performs the physical/packaging check via the DG AutoCheck UI.
- **DG Process Verification** — DG AutoCheck verifies the documentation and packaging.
- **Documentation Packaging** — Documents are packaged and the check is signed off.
- **Ready for Carriage** — Acceptance check completes and CMS is notified.

The CMS and a mobile/desktop browser interact with DG AutoCheck through API calls. The CMS owns the user-facing workflow.

---

## 3. How It Works

The process relies on a user logging into the CMS and launching the DG Check from there.

- The CMS owns the whole check process and runs the DGD acceptance check process **as the user**, meaning the acceptance staff does not need to manually log on to DG AutoCheck — the CMS effectively "logs in" to DG AutoCheck on their behalf, by identifying the user performing the check.
- The user is taken to DG AutoCheck, performs the check, and is returned to the CMS. This gives the user a seamless acceptance-check experience.
- Users and Offices are entirely managed in CMS, including user certifications.
- Acceptance staff never log in to DG AutoCheck via the website, **except for Admin users** who manage settings, reports, etc.

---

## 4. API Integrator Process

The high-level flow between the integrating system (CMS) and DG AutoCheck:

1. **Initiate a DG AutoCheck API call** — CMS passes relevant data to register a new "Check".
2. **DG AutoCheck registers the check** — Loads relevant details, generates a "Check container", and returns a URL for the check.
3. **CMS opens the URL in the browser** — Generates an authenticated connection to the provided single-use URL.
4. **Browser-based acceptance check** — The user performs the acceptance check in the DG AutoCheck application.
5. **Auto Check completed** — DG AutoCheck performs a basic HTTP GET response to the configured "complete" URL.
6. **CMS records acceptance check completion status**.
7. **CMS makes follow-up API calls** to retrieve the XSDG, PDF report, status, and any other supporting details.

Supporting/incidental API calls include:

- Status checks
- Reports
- XSDG export

---

## 5. Initiating a DG AutoCheck Acceptance Check

CMS requests an Acceptance Check from DG AutoCheck. It can pass the following optional parameters:

- **DGD Input source:** PDF or XSDG
- **User Name:** Indication of the user initiating the check
- **Office / Hub:** Details of the location
- **Acceptance Check Parameters** (these may be set by the subscription)
- **Complete URL:** URL to post the completion alert to (may be set by the subscription)

DG AutoCheck returns:

- **Unique Identifier** for this specific acceptance check (a short GUID). This will be used for all future communications with the API.
- **Communication URL:** A one-time code/URL for accessing the acceptance check.

---

## 6. When an Acceptance Check is Completed

On completing an acceptance check, DG AutoCheck can send a very basic ("no critical information") response to CMS. The "return URL" used by DG AutoCheck will be set on creation of the session **OR** as part of the subscription setup.

DG AutoCheck will return:

- **The Short UID Acceptance Check Identifier** — Simply alerts the initiating system that the check has completed. No information regarding pass/fail is included in this notification.

CMS can then interrogate the API for further information about the check.

---

## 7. Other Supporting API Endpoints

| Endpoint | Description |
| --- | --- |
| `AcceptanceCheckStatus` | Current status of the acceptance check. |
| `GenerateXSDG` | Create an XSDG from the DGD data used for the acceptance check. |
| `AcceptanceReport` | Returns a PDF report of the acceptance check. |
| `AcceptanceCheckUrl` | Create a new single-use URL to access the acceptance check. Provide user information as part of this request for trackability (see Offices & Users). |
| `Download Resources` | Users can upload resources during a check; this endpoint allows retrieval of those resources from DG AutoCheck. |

---

## 8. Authentication

- Acceptance Check URLs are **single use** and only acceptable within a defined timeframe of their creation. This eliminates the need for any further "access encryption".
- All contact with DG AutoCheck is via **HTTPS**.
- Users cannot run duplicate sessions with DG AutoCheck.
- If DG AutoCheck can identify the user, it can also maintain the integrity of the check — i.e. it can allow a user to "take over" an existing check while preserving the current acceptance-check workflow.

---

## 9. Offices & Users

There are two possible modes for handling user information:

1. **Single user assigned to the API** for the subscription. This user is always seen as the user who completed the acceptance check. *Side effect:* DG AutoCheck cannot identify who did which action.
2. **User details passed to the API**, with new users created on the fly if they do not already exist. A unique identifier should be passed from CMS so duplicate users are not created. User information does not have to be the user's real details if there are data-protection concerns. *Benefit:* Trackability of who did which action — fully trackable in DG AutoCheck's audit trail.

Office information may be set up ahead of time, OR sent as part of the acceptance check request. **A unique identifier must be sent** from the integrating system so that duplicate offices are not created.

---

## 10. Passing DGD Data into DG AutoCheck

The API supports the following input formats:

- **PDF**
- **XSDG**

---

## 11. DG AutoCheck Integration Flow

The end-to-end interaction between CMS and DG AutoCheck:

```
CMS:           UPLOAD DGD PDF  ─►  Start Check  ─►  DGD Export  ─►  Acceptance Check PDF  ─►  Process Webhook Event
                  │                  │                │                 │                          │
API methods:   API: Create        API: Create     API: Request Url   API: Acceptance Check     API: DGD Export / Acceptance Check Report
                  │
DG AutoCheck:  PDF / XSDG / DGD ─► OCR DGD ─► Verification ─► Document Check ─► Packaging Check ─► Sign Off
                                                  │              │                  │                  │
States:                                       Start Check    Resume Check       Check Status      Webhook Event
```

### Webhook events emitted

- `acceptance-check-created`
- `ocr-completed`
- `xsdg-imported`
- `acceptance-check-conflicted`
- `verification-started`
- `verification-completed`
- `documentation-check-started`
- `documentation-check-completed`
- `acceptance-check-completed`
- `acceptance-check-failed`
- `acceptance-check-passed`

---

## 12. Create DGD — General Principles

When performing an acceptance check with DG AutoCheck, the integrating system (CMS) requests an **acceptance check id** from DG AutoCheck. This id is then used by CMS for all future interactions with that unique acceptance check. CMS should store the acceptance check id locally against the particular check.

Two main properties are required to perform an acceptance check:

1. An **office reference**.
2. A **user reference**.

Both are managed by CMS and require no setup in DG AutoCheck. If a new office or user is passed into DG AutoCheck, it creates a local reference to it.

When requesting an acceptance check id, CMS shall pass in an **office reference**. The user reference is optional at the time of creation, but in order to request a URL to access the acceptance check, CMS shall provide a **user reference**. This ensures that all interactions with the acceptance check are correctly logged against the appropriate user. **It is the CMS's responsibility** to pass in the correct user reference when requesting an access URL to DG AutoCheck.

---

## 13. Create DGD — Option 1: No DGD Passed from CMS

In this scenario, CMS registers a new acceptance check with DG AutoCheck, and then the user manually uploads the DGD (as a PDF or XSDG) via the DG AutoCheck interface.

DG AutoCheck starts from a blank acceptance check, and the user is required to load a DGD from either a PDF or XSDG source. If the user uploads a PDF, it will be OCRed by DG AutoCheck and then the user will need to verify that the scanned content matches the DGD before the checker can start the acceptance. If an XSDG file is uploaded, no verification step is required and the acceptance check can be started immediately.

**API call sequence:**

1. **Create** — Creates and returns an Acceptance Check Id for the specific check. An office reference is mandatory. If CMS also passes in a user reference, the API will return a Request URL in the response, removing the need for the next call.
2. **Request URL** — Can be called at any time to continue an acceptance check. CMS passes in the Acceptance Check Id returned from `Create` and a user reference; a "one-time use" URL is returned.
3. **Launch DG AutoCheck session** — CMS loads the URL provided. This URL returns the user to the correct place in the acceptance check.

---

## 14. Create DGD — Option 2: PDF DGD Passed from CMS

In this scenario, CMS registers a new acceptance check with DG AutoCheck and passes a DGD in PDF format into the new acceptance check.

DG AutoCheck receives a PDF from CMS, OCRs it, and then the user needs to verify that the scanned content matches the DGD before the user can start the acceptance check.

**API call sequence:**

1. **Create** — Creates and returns an Acceptance Check Id. An office reference is mandatory. There is no advantage to passing in a user reference at this point, as CMS will need to load the PDF as the next step.
2. **Scan PDF** — The system places a PDF in the body of the request and references the acceptance check id returned from the above call to load a PDF into DG AutoCheck against the referenced acceptance check. The PDF will automatically be scanned and the status of the check will be set to *requiring Verification*.
3. **Request URL** — Can be called at any time to continue an acceptance check. CMS passes in the Acceptance Check Id and a user reference; a "one-time use" URL is returned.
4. **Launch DG AutoCheck session** — CMS loads the URL provided.

---

## 15. Create DGD — Option 3: XSDG Passed from CMS

In this scenario, CMS registers a new acceptance check with DG AutoCheck and passes a valid XSDG into the new acceptance check.

DG AutoCheck receives a validated DGD from CMS, so the user can start the acceptance check with no requirement to verify the content — the acceptance check can be started immediately.

**API call sequence:**

1. **Create** — Creates and returns an Acceptance Check Id. An office reference is mandatory. There is no advantage to passing in a user reference at this point, as CMS will need to load the XSDG as the next step.
2. **Import XSDG** — CMS places an XSDG in the body of the request and references the acceptance check id returned from the above call to load an XSDG into DG AutoCheck against the referenced acceptance check. This will automatically be imported and set the status of the check to begin the Document check.
3. **Request URL** — Can be called at any time to continue an acceptance check. CMS passes in the Acceptance Check Id and a user reference; a "one-time use" URL is returned.
4. **Launch DG AutoCheck session** — CMS loads the URL provided.

---

## 16. Resume Acceptance Check

Once CMS has an Acceptance Check Id (returned from the `Create` method), CMS can use this at any time to launch a session in DG AutoCheck for that particular acceptance check.

The `Request URL` API call requires CMS to identify which user will be using the session. If that user is unknown to DG AutoCheck, it will create a user for them and all future checks they perform will be logged against the same user. If the user is not a member of the office defined when the acceptance check id was created, then they will be automatically assigned to that office.

When launching the session, the user will be automatically returned to the correct location in the check. For example, if the Documentation check has been completed, the user will be returned to the Packaging check. If the acceptance check is totally completed and signed off, the user will be presented with the Sign Off screen.

**API call sequence:**

1. **Request URL** — CMS passes in the Acceptance Check Id and a user reference; a "one-time use" URL is returned.
2. **Launch DG AutoCheck session** — CMS loads the URL provided.

---

## 17. Webhook Events

Webhooks let your server get notified when something has happened on DG AutoCheck. Webhooks are **outbound** — DG AutoCheck notifies your CMS when an event happens (e.g. the completion of an acceptance check) that you want to know about.

All you need to do is set up a listener URL on your server and configure that into your DG AutoCheck webhook settings.

When you receive a webhook notification, you can use the basic information received — the acceptance check id and event type — and then CMS can decide which DG AutoCheck APIs to call to receive more detailed information.

**Webhook event call sequence:**

1. DG AutoCheck event triggers a webhook event that has been configured by your Super User.
2. CMS receives the webhook event.
3. CMS validates the webhook event.
4. CMS processes the webhook event and decides which API, if any, should be called.
5. CMS makes the API request.

---

## 18. Getting Started

### API basics

The API is a collection of RESTful web services. You interact with resources by sending an HTTP message to a URL. The URL determines the resource and the HTTP method defines the type of action.

- Access is controlled via tokens (**OAuth 2.0**).
- To get a token you must call the token endpoint with your access credentials.
- Tokens remain valid for a limited time.
- Authentication is done with **Client Id + Secret**.
- Payloads are XML / JSON serializable objects.

### High-level steps for developers

1. Set up your access credentials in DG AutoCheck.
2. Get your access token from DG AutoCheck.
3. Set up your webhook notifications.
4. Get your verification signature for the webhook messages.
5. Use your verification signature to validate webhook notifications.
6. Use your access token to make API calls.

---

## 19. Access Credentials

To access the Connect API, you first need to create access credentials. You will use these to create your access token, which you will need when accessing API methods.

### Create access credentials

On the **Create** screen, specify:

- **Name** — for your convenience.
- **Valid Until** — the date until which this access information is valid.
- **Permissions** — `List` permission is for listing existing checks; `Read` is for individual checks. `Read` permission is a higher level than `List`.

Upon clicking **Save**, the system generates your `Key` and `Secret`.

### Key and secret

- **Key** = your `client_id`
- **Secret** = your `client_secret`

These are used when requesting the authentication token for accessing API methods.

> **Important:** The Secret will not be shown again — keep it somewhere safe.

### Edit access credentials

On the edit page you can change all information, plus you can recreate your secret (which will invalidate the previous one). If you lose your secret, you can recreate it here. You can also remove your access credential entirely.

---

## 20. Creating an Access Token

After creating your access credentials, you are ready to create your token for accessing API methods. Use the OAuth link in the authorization section to get your access token.

You will make an HTTP `GET` call with `grant_type`, `client_id`, and `client_secret` values. DG AutoCheck will return your access token.

### Sample access token request

**Endpoint:** `GET {{domain}}/oauth2/token`

**Example request:**

```bash
curl --location -g --request GET '{{domain}}/oauth2/token' \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'grant_type=client_credentials' \
  --data-urlencode 'client_id=' \
  --data-urlencode 'client_secret='
```

The response from DG AutoCheck includes the `access_token`.

---

## 21. Using the Access Token for API Calls

Add the token to the header of your API call as the `Authorization` value, prefixed with `Bearer`:

```http
Authorization: Bearer <access_token>
```

The same token can be used as long as it is within its validity period, which is shown in the token response as `expires_in` (in seconds).

---

## 22. Webhook Setup

### Create webhooks

Once you set up a listener URL on your system, you can program that URL into your DG AutoCheck webhook settings. A `POST` request will be sent to your specified endpoint URL whenever the selected action(s) happen within your DG AutoCheck subscription.

Upon clicking **Create**, the system generates your **Verification Token**.

### Verification token

The Verification Token is displayed below the webhook endpoint URL. You can use this token in combination with the `x-dgautocheck-signature` header to verify that DG AutoCheck is the sender of a webhook message.

---

## 23. Securing Webhooks with Signature Verification

> Although this step is optional, we strongly recommend it to improve security.

You can use this 3-step procedure to validate an individual webhook request to ensure it was sent by DG AutoCheck.

### Step 1 — Get the Verification Token

To verify the `x-dgautocheck-signature` header value, you must first obtain the Verification Token for your account from DG AutoCheck. Every webhook request sent to your endpoint will use the same Verification Token. **This token won't change** for your account.

### Step 2 — Concatenate Verification Token and Request Body

Once you have the Verification Token, concatenate it with the **raw string** representing the request body that was received. Do not convert the request body to any other type of object; if the library you're using automatically converts the request body to an object, look for a method to obtain the raw request body as text.

### Step 3 — Calculate the SHA-256 Hash

Calculate the SHA-256 hash of the concatenation. The result should match the contents of the `x-dgautocheck-signature` header.

> **Tip:** A simple code snippet for testing the verification: <https://dotnetfiddle.net/H5T8Gz>

---

## 24. Webhook — Example Payload

The payload sent to the listener URL has 4 parameters:

1. **`attempt`** — The retry attempt sequence.
2. **`eventLogId`** — A GUID used to find events in the webhook logs in DG AutoCheck.
3. **`event`** — The reference of the event being sent.
4. **`acceptanceCheckId`** — The reference to the acceptance check that generated the event. This reference can be used in conjunction with the DG AutoCheck APIs to gather more information.

### Events supported in version 1

1. `acceptance-check-created` — Acceptance Check Created. (XSDG creates the AC at the same time as it creates it, but the API and File-upload variants have the DGD data available later.)
2. `ocr-completed` — Triggered when a DGD OCR scan has completed.
3. `xsdg-imported` — Triggered when an XSDG has been imported.
4. `acceptance-check-conflicted` — Acceptance Check Conflicted (can happen when website / tablet become out of sync, which is essentially another creation hook).
5. `acceptance-check-completed`
6. `acceptance-check-failed`
7. `acceptance-check-passed`

### Example

**Verification Token:**

```
efb7e0030e6cef1b45d3d74a67881a2b
```

**Headers:**

```http
x-dgautocheck-signature: 31f3204561293844f07d8ce63b39f02d
x-timestamp: "2011-08-12T20:17:46.384Z"
```

**Raw payload:**

```json
{"eventLogId":"db82366d-cf94-4816-947f-55935ba21e98","event":"acceptance-check-passed","acceptanceCheckId":"Dwl3r"}
```

**JSON-formatted payload:**

```json
{
  "attempt": 1,
  "eventLogId": "db82366d-cf94-4816-947f-55935ba21e98",
  "event": "acceptance-check-passed",
  "acceptanceCheckId": "Dwl3r"
}
```

**Signature check:**

```
x-dgautocheck-signature = sha256("Verification Token" + "Raw Payload")
```

---

## 25. Webhook Logs

DG AutoCheck shows all recent webhook logs for the subscription. Click **Detail** on any log entry to see full webhook details, including the payload and the response received from your endpoint.

---

## 26. Full API Documentation

Documentation for all Acceptance Check API endpoints is published in Postman:

<https://documenter.getpostman.com/view/883478/2s935hS7zA#intro>

---

*© IATA — DG AutoCheck Connect API Full Integration documentation, version 7.2 (January 2026).*
