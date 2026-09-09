# Healthcare Clinic Management System (HCMS) - Complete API Contract Specification

This document provides the exhaustive API contract specification for all **38 endpoints** used by the HCMS application frontend (`lib/providers/api.ts`). Backend implementations (in NestJS, Express, Django, Go, Laravel, or Next.js App Router) **must** comply with these data structures, headers, parameters, and HTTP responses.

---

## Table of Contents
1. [General Specifications & Authentication](#1-general-specifications--authentication)
2. [Data Models & Types](#2-data-models--types)
3. [Auth & User Module](#3-auth--user-module)
4. [Subscription Module](#4-subscription-module)
5. [Patients Module](#5-patients-module)
6. [Visits & Prescriptions Module](#6-visits--prescriptions-module)
7. [Medicines Module](#7-medicines-module)
8. [Prescription Templates Module](#8-prescription-templates-module)
9. [Clinic Settings Module](#9-clinic-settings-module)
10. [Dashboard Metrics Module](#10-dashboard-metrics-module)
11. [App Options & Custom Choices Module](#11-app-options--custom-choices-module)

---

## 1. General Specifications & Authentication

- **Base URL**: `http://localhost:3000/api` (or configured via `NEXT_PUBLIC_API_URL`)
- **Headers**:
  - `Content-Type`: `application/json`
  - `Authorization`: `Bearer <jwt_token>` (for protected endpoints)
- **Standard HTTP Error Response**:
```json
{
  "success": false,
  "error": "Error description or message"
}
```

---

## 2. Data Models & Types

### 2.1 `Patient` Object
```typescript
interface Patient {
  id?: number;
  patientId: string; // Format: OPD-YYYYMMDD-XXXX
  name: string;
  age?: number;
  dob?: string; // YYYY-MM-DD
  gender: string; // 'Male' | 'Female' | 'Other'
  mobile: string;
  address?: string;
  occupation?: string;
  abhaNumber?: string;
  createdAt: string; // ISO 8601 Timestamp
}
```

### 2.2 `PrescribedMedicine` Object
```typescript
interface PrescribedMedicine {
  medicineId?: number;
  name: string;
  dose: string; // e.g. "1-0-1"
  duration: string; // e.g. "5 days"
  instructions?: string;
  instructionKeys?: string[];
  customInstruction?: string;
  instructionLangs?: ('en' | 'hi' | 'mr')[];
}
```

### 2.3 `Visit` Object
```typescript
interface Visit {
  id?: number;
  patientId: string;
  category: string; // e.g. 'OPD', 'IPD', 'Suwarna Pashan'
  date: string; // ISO String or YYYY-MM-DD
  chiefComplaints: string;
  diagnosis: string;
  bp?: string;
  pulse?: string;
  temp?: string;
  spo2?: string;
  weight?: string;
  treatment?: string;
  prescriptionNotes?: string;
  medicines?: PrescribedMedicine[];
  followUpDate?: string; // YYYY-MM-DD
  followUpAttended?: boolean;
  createdAt: string;
}
```

### 2.4 `Medicine` Object
```typescript
interface Medicine {
  id?: number;
  name: string;
  category: string;
  defaultDose: string;
  defaultDuration: string;
  unit?: string;
  strength?: string;
}
```

### 2.5 `Template` Object
```typescript
interface Template {
  id?: number;
  name: string;
  diagnosis: string;
  medicines: PrescribedMedicine[];
  notes?: string;
  createdAt: string;
}
```

### 2.6 `ClinicSettings` Object
```typescript
interface ClinicSettings {
  doctorName: string;
  degree: string;
  clinicName: string;
  address: string;
  phone: string;
  regNo: string;
  city: string;
}
```

### 2.7 `AppOption` Object
```typescript
interface AppOption {
  id: number;
  optionType: string; // 'chiefComplaint' | 'diagnosis' | 'instruction' | etc.
  value: string;
  createdAt: string;
}
```

---

## 3. Auth & User Module

### 3.1 Login
- **Method**: `POST`
- **Endpoint**: `/api/auth/login`
- **Request Body**:
```json
{
  "email": "doctor@clinic.com",
  "password": "securepassword"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1Ni...",
  "user": {
    "email": "doctor@clinic.com",
    "doctorName": "Dr. Smith",
    "clinicName": "City Clinic"
  }
}
```

### 3.2 Signup
- **Method**: `POST`
- **Endpoint**: `/api/auth/signup`
- **Request Body**:
```json
{
  "email": "doctor@clinic.com",
  "password": "securepassword",
  "doctorName": "Dr. Smith",
  "degree": "MBBS, MD",
  "clinicName": "City Health Clinic",
  "address": "123 Main St",
  "phone": "9876543210",
  "regNo": "REG-12345",
  "city": "Mumbai"
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1Ni...",
  "user": { ... }
}
```

### 3.3 Update User / Clinic Details
- **Method**: `PUT`
- **Endpoint**: `/api/auth/user`
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**: Partial update object of user/clinic fields.
- **Response (200 OK)**:
```json
{
  "success": true,
  "user": { ... }
}
```

---

## 4. Subscription Module

### 4.1 Get Subscription Status
- **Method**: `GET`
- **Endpoint**: `/api/subscription/status`
- **Headers**: `Authorization: Bearer <token>`
- **Response (200 OK)**:
```json
{
  "subscription": {
    "planType": "premium",
    "subscriptionStatus": "active",
    "billingCycle": "monthly",
    "hasSelectedPlan": true,
    "paidAmount": 299,
    "paymentRef": "UTR123456789",
    "subscriptionStartDate": "2026-09-01T00:00:00.000Z",
    "subscriptionEndDate": "2026-10-01T00:00:00.000Z",
    "activatedAt": "2026-09-01T00:00:00.000Z"
  }
}
```

### 4.2 Select Plan (Free Trial / Premium)
- **Method**: `POST`
- **Endpoint**: `/api/subscription/select-plan`
- **Request Body**: `{ "planType": "trial" }`
- **Response (200 OK)**: `{ "success": true, "subscription": { ... }, "message": "Trial activated" }`

### 4.3 Verify Payment & Activate Plan
- **Method**: `POST`
- **Endpoint**: `/api/subscription/verify-payment`
- **Request Body**: `{ "paymentRef": "UTR123456789", "amount": 299, "planType": "premium" }`
- **Response (200 OK)**: `{ "success": true, "subscription": { ... }, "transactionId": "TXN_123" }`

### 4.4 Create Razorpay Order
- **Method**: `POST`
- **Endpoint**: `/api/subscription/razorpay-order`
- **Request Body**: `{ "planId": "premium", "amount": 29900 }`
- **Response (200 OK)**: `{ "success": true, "orderId": "order_123", "amount": 29900, "currency": "INR", "key": "rzp_test_xxx" }`

---

## 5. Patients Module

### 5.1 List Patients
- **Method**: `GET`
- **Endpoint**: `/api/patients`
- **Query Parameters**:
  - `search` (string, optional): Search by name, mobile, or patientId
  - `category` (string, optional): Filter by patient category
  - `page` (number, optional)
  - `limit` (number, optional)
- **Response (200 OK)**: `Patient[]`

### 5.2 Generate Next Patient ID
- **Method**: `GET`
- **Endpoint**: `/api/patients/generate-id`
- **Response (200 OK)**:
```json
{
  "id": "OPD-20260909-0001"
}
```

### 5.3 Get Patient by ID
- **Method**: `GET`
- **Endpoint**: `/api/patients/:patientId`
- **Response (200 OK)**: `Patient` object (or 404 error if not found)

### 5.4 Create Patient
- **Method**: `POST`
- **Endpoint**: `/api/patients`
- **Request Body**: `CreatePatientInput` (`Omit<Patient, 'id' | 'patientId' | 'createdAt'>` or including `patientId`)
- **Response (201 Created)**: Created `Patient` object

### 5.5 Update Patient
- **Method**: `PUT`
- **Endpoint**: `/api/patients/:patientId`
- **Request Body**: `UpdatePatientInput`
- **Response (200 OK)**: Updated `Patient` object

### 5.6 Delete Patient
- **Method**: `DELETE`
- **Endpoint**: `/api/patients/:patientId`
- **Response (200 OK)**: `{ "success": true }`

### 5.7 Get Patient Visits
- **Method**: `GET`
- **Endpoint**: `/api/patients/:patientId/visits`
- **Response (200 OK)**: Array of `Visit` objects for the patient

---

## 6. Visits & Prescriptions Module

### 6.1 List Visits
- **Method**: `GET`
- **Endpoint**: `/api/visits`
- **Query Parameters**: `patientId`, `startDate`, `endDate`, `page`, `limit`
- **Response (200 OK)**: `Visit[]`

### 6.2 Get Today's Visits
- **Method**: `GET`
- **Endpoint**: `/api/visits/today`
- **Response (200 OK)**: `Visit[]` recorded for current date

### 6.3 Get Today's Follow-ups
- **Method**: `GET`
- **Endpoint**: `/api/visits/followups/today`
- **Response (200 OK)**: Array of `{ visit: Visit, patient: Patient | undefined }`

### 6.4 Get Upcoming Follow-ups
- **Method**: `GET`
- **Endpoint**: `/api/visits/followups/upcoming`
- **Query Parameters**: `days` (number, default: 7)
- **Response (200 OK)**: Array of `{ visit: Visit, patient: Patient | undefined }`

### 6.5 Get Visit by ID
- **Method**: `GET`
- **Endpoint**: `/api/visits/:visitId`
- **Response (200 OK)**: `Visit` object

### 6.6 Create Visit
- **Method**: `POST`
- **Endpoint**: `/api/visits`
- **Request Body**: `CreateVisitInput`
- **Response (201 Created)**: Created `Visit` object

### 6.7 Update Visit
- **Method**: `PUT`
- **Endpoint**: `/api/visits/:visitId`
- **Request Body**: `UpdateVisitInput`
- **Response (200 OK)**: Updated `Visit` object

### 6.8 Delete Visit
- **Method**: `DELETE`
- **Endpoint**: `/api/visits/:visitId`
- **Response (200 OK)**: `{ "success": true }`

### 6.9 Mark Follow-up Attended
- **Method**: `POST`
- **Endpoint**: `/api/visits/:visitId/mark-attended`
- **Response (200 OK)**: Updated `Visit` object with `followUpAttended: true`

---

## 7. Medicines Module

### 7.1 List Medicines
- **Method**: `GET`
- **Endpoint**: `/api/medicines`
- **Query Parameters**: `search`, `category`
- **Response (200 OK)**: `Medicine[]`

### 7.2 Create Medicine
- **Method**: `POST`
- **Endpoint**: `/api/medicines`
- **Request Body**: `CreateMedicineInput`
- **Response (201 Created)**: Created `Medicine` object

### 7.3 Bulk Create Medicines
- **Method**: `POST`
- **Endpoint**: `/api/medicines/bulk`
- **Request Body**: `{ "medicines": [ { "name": "...", "category": "...", ... } ] }`
- **Response (201 Created)**: `Medicine[]`

### 7.4 Update Medicine
- **Method**: `PUT`
- **Endpoint**: `/api/medicines/:id`
- **Request Body**: `UpdateMedicineInput`
- **Response (200 OK)**: Updated `Medicine` object

### 7.5 Delete Medicine
- **Method**: `DELETE`
- **Endpoint**: `/api/medicines/:id`
- **Response (200 OK)**: `{ "success": true }`

### 7.6 Seed Default Medicines
- **Method**: `POST`
- **Endpoint**: `/api/medicines/seed`
- **Response (200 OK)**: `{ "success": true, "message": "Medicines seeded successfully" }`

---

## 8. Prescription Templates Module

### 8.1 List Templates
- **Method**: `GET`
- **Endpoint**: `/api/templates`
- **Response (200 OK)**: `Template[]`

### 8.2 Create Template
- **Method**: `POST`
- **Endpoint**: `/api/templates`
- **Request Body**: `CreateTemplateInput`
- **Response (201 Created)**: Created `Template` object

### 8.3 Delete Template
- **Method**: `DELETE`
- **Endpoint**: `/api/templates/:id`
- **Response (200 OK)**: `{ "success": true }`

---

## 9. Clinic Settings Module

### 9.1 Get Settings
- **Method**: `GET`
- **Endpoint**: `/api/settings`
- **Response (200 OK)**: `ClinicSettings` object

### 9.2 Update Settings
- **Method**: `PUT`
- **Endpoint**: `/api/settings`
- **Request Body**: `Partial<ClinicSettings>`
- **Response (200 OK)**: Updated `ClinicSettings` object

---

## 10. Dashboard Metrics Module

### 10.1 Get Dashboard Stats
- **Method**: `GET`
- **Endpoint**: `/api/dashboard/stats`
- **Response (200 OK)**:
```json
{
  "todayTotal": 12,
  "todayNew": 4,
  "todayReturning": 8,
  "totalPatients": 350,
  "followUpsToday": 3,
  "upcomingFollowUps": 15,
  "recentVisits": [
    {
      "visit": { "id": 1, "patientId": "OPD-20260909-0001", "date": "2026-09-09", "chiefComplaints": "Fever" },
      "patient": { "patientId": "OPD-20260909-0001", "name": "John Doe", "gender": "Male", "mobile": "9876543210" }
    }
  ],
  "todayFollowUpList": [ ... ]
}
```

---

## 11. App Options & Custom Choices Module

### 11.1 List Options
- **Method**: `GET`
- **Endpoint**: `/api/options`
- **Query Parameters**: `type` (optional, e.g. `chiefComplaint`, `diagnosis`)
- **Response (200 OK)**: `AppOption[]`

### 11.2 Create Option
- **Method**: `POST`
- **Endpoint**: `/api/options`
- **Request Body**: `{ "optionType": "diagnosis", "value": "Hypertension Stage 1" }`
- **Response (201 Created)**: Created `AppOption` object

### 11.3 Delete Option
- **Method**: `DELETE`
- **Endpoint**: `/api/options/:id`
- **Response (200 OK)**: `{ "success": true }`
