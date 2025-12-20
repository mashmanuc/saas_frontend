# Marketplace v0.36 — E2E QA Log (Tutor → Publish → Student sees)

> **Purpose:** This file is the contract QA artifact for the v0.36 Marketplace release. Every row below must be verified in browser devtools **Network** and visually in UI.

---

## 0) Environments

- **Frontend:** `frontend` repo, current branch
- **API base:** `/api/v1/...`
- **Browsers:** Chrome (primary)

---

## 1) Tutor role (TUTOR)

### 1.1 Open My Profile

- **URL**
  - `/marketplace/my-profile`
- **Expected UI**
  - Page loads without errors
  - Editor shows existing data or create prompt
- **Network**
  - `GET /api/v1/marketplace/tutors/me/` → `200`
  - `GET /api/v1/marketplace/filters/` → `200`

### 1.2 Save draft (PATCH)

- **Action**
  - Change headline/bio/price, click Save
- **Network**
  - `PATCH /api/v1/marketplace/tutors/me/` → `200`
- **Expected UI**
  - No errors
  - Values persist after reload

### 1.3 Submit for review

- **Action**
  - Click "Submit for review"
- **Network**
  - `POST /api/v1/marketplace/tutors/me/submit/` → `200` OR `422`
- **Expected UI**
  - On `422`: field errors displayed next to corresponding inputs
  - On `200`: status changes to pending_review

### 1.4 Publish

- **Action**
  - Click "Publish"
- **Network**
  - `POST /api/v1/marketplace/tutors/me/publish/` → `200` OR `422`
- **Expected UI**
  - On `422`: field errors displayed next to corresponding inputs
  - **Certifications are NOT required** for publish

### 1.5 Certifications (upload)

- **Action**
  - Add certification (title/issuer/year/file)
- **Network**
  - `POST /api/v1/uploads/presign/certification/` → `200`
  - `PUT {upload_url}` → `2xx`
  - `POST /api/v1/marketplace/tutors/me/certifications/` → `201/200`
- **Expected UI**
  - Upload progress visible
  - Certification appears in list with status

### 1.6 Certifications (toggle public)

- **Action**
  - Toggle "Show on public profile"
- **Network**
  - `PATCH /api/v1/marketplace/tutors/me/certifications/{id}/` → `200`
- **Expected UI**
  - Toggle reflects immediately

### 1.7 Certifications (delete)

- **Action**
  - Delete certification
- **Network**
  - `DELETE /api/v1/marketplace/tutors/me/certifications/{id}/` → `204`
- **Expected UI**
  - Item removed from list

---

## 2) Student role (STUDENT)

### 2.1 Catalog loads

- **URL**
  - `/marketplace`
- **Network**
  - `GET /api/v1/marketplace/tutors/?page=...` → `200`
- **Expected UI**
  - List of tutors renders
  - No legacy endpoints called

### 2.2 Open tutor detail

- **Action**
  - Click "Open" on a tutor card
- **Network**
  - `GET /api/v1/marketplace/tutors/{slug}/` → `200`
- **Expected UI**
  - Header (name, headline, rating)
  - Badges (if any)
  - Subjects/About blocks
  - Availability widget renders safely

### 2.3 Reviews list

- **Network**
  - `GET /api/v1/marketplace/tutors/{slug}/reviews/?page=...` → `200`
- **Expected UI**
  - Reviews list renders
  - Empty state if no reviews

### 2.4 Write review

- **Action**
  - Click "Write review" and submit
- **Network**
  - `POST /api/v1/marketplace/tutors/{slug}/reviews/` → `201/200` OR `422/409/429`
- **Expected UI**
  - Friendly error messages for 422/409/429
  - On success: list reloads and new review appears

---

## 3) Notes / Evidence

- **Screenshots:**
  - Add links or paste into PR
- **Network capture:**
  - Endpoints + statuses for each step
