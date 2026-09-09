// lib/validations/schemas.ts
import * as yup from 'yup';

// ── Patient Registration Schema ──────────────────────────────────────
export const patientSchema = yup.object({
  name: yup
    .string()
    .trim()
    .required('Patient full name is required')
    .min(2, 'Name must be at least 2 characters'),
  dob: yup.string().optional(),
  age: yup
    .string()
    .optional()
    .test('is-valid-age', 'Age must be a valid number between 0 and 120', (val) => {
      if (!val || val.trim() === '') return true;
      const num = Number(val);
      return !isNaN(num) && num >= 0 && num <= 120;
    }),
  gender: yup.string().required('Gender selection is required'),
  mobile: yup
    .string()
    .trim()
    .required('10-digit mobile number is required')
    .test('is-valid-mobile', 'Please enter a valid 10-digit mobile number', (val) => {
      if (!val) return false;
      const digits = val.replace(/\D/g, '');
      return digits.length === 10;
    }),
  abhaNumber: yup
    .string()
    .optional()
    .test('is-valid-abha', 'ABHA number must be exactly 14 digits', (val) => {
      if (!val || val.trim() === '') return true;
      const digits = val.trim().replace(/\D/g, '');
      return digits.length === 14;
    }),
  address: yup.string().optional(),
  occupation: yup.string().optional(),
});

// ── Doctor Signup Step 1 Schema ──────────────────────────────────────
export const signupStep1Schema = yup.object({
  doctorName: yup
    .string()
    .trim()
    .required('Doctor name is required')
    .min(2, 'Doctor name must be at least 2 characters'),
  email: yup
    .string()
    .trim()
    .required('Email address is required')
    .email('Please enter a valid email address (e.g. doctor@clinic.com)'),
  password: yup
    .string()
    .required('Password is required')
    .min(6, 'Password must be at least 6 characters'),
  degree: yup.string().optional(),
});

// ── Doctor Signup Step 2 Schema ──────────────────────────────────────
export const signupStep2Schema = yup.object({
  clinicName: yup
    .string()
    .trim()
    .required('Clinic / Hospital name is required')
    .min(2, 'Clinic name must be at least 2 characters'),
  regNo: yup.string().optional(),
  phone: yup
    .string()
    .optional()
    .test('is-valid-phone', 'Phone number must be a valid 10-digit number', (val) => {
      if (!val || val.trim() === '') return true;
      const digits = val.replace(/\D/g, '');
      return digits.length === 10;
    }),
  city: yup.string().optional(),
  address: yup.string().optional(),
});

// ── Doctor Login Schema ──────────────────────────────────────────────
export const loginSchema = yup.object({
  email: yup
    .string()
    .trim()
    .required('Email address is required')
    .email('Please enter a valid email address'),
  password: yup.string().required('Password is required'),
});

// ── OPD Visit Validation Schema ──────────────────────────────────────
export const visitSchema = yup.object({
  patientId: yup.string().required('Please select a patient'),
  category: yup.string().required('OPD Visit category is required'),
  chiefComplaints: yup.string().trim().required('Chief complaints are required'),
  diagnosis: yup.string().optional(),
  bp: yup
    .string()
    .optional()
    .test('is-valid-bp', 'BP format must be Systolic/Diastolic (e.g. 120/80)', (val) => {
      if (!val || val.trim() === '') return true;
      return /^\d{2,3}\/\d{2,3}$/.test(val.trim());
    }),
  pulse: yup
    .string()
    .optional()
    .test('is-valid-pulse', 'Pulse rate must be between 30 and 250 bpm', (val) => {
      if (!val || val.trim() === '') return true;
      const num = Number(val);
      return !isNaN(num) && num >= 30 && num <= 250;
    }),
  temp: yup
    .string()
    .optional()
    .test('is-valid-temp', 'Temperature must be between 90°F and 110°F', (val) => {
      if (!val || val.trim() === '') return true;
      const num = Number(val);
      return !isNaN(num) && num >= 90 && num <= 110;
    }),
  spo2: yup
    .string()
    .optional()
    .test('is-valid-spo2', 'SpO2 must be between 50% and 100%', (val) => {
      if (!val || val.trim() === '') return true;
      const num = Number(val);
      return !isNaN(num) && num >= 50 && num <= 100;
    }),
  weight: yup
    .string()
    .optional()
    .test('is-valid-weight', 'Weight must be between 0.5 and 300 kg', (val) => {
      if (!val || val.trim() === '') return true;
      const num = Number(val);
      return !isNaN(num) && num >= 0.5 && num <= 300;
    }),
});

// Helper function to run Yup validation and extract structured errors
export async function validateForm<T extends Record<string, any>>(
  schema: yup.ObjectSchema<any>,
  data: T
): Promise<{ isValid: boolean; errors: Partial<Record<keyof T, string>> }> {
  try {
    await schema.validate(data, { abortEarly: false });
    return { isValid: true, errors: {} };
  } catch (err) {
    if (err instanceof yup.ValidationError) {
      const errors: Partial<Record<keyof T, string>> = {};
      err.inner.forEach((e) => {
        if (e.path && !errors[e.path as keyof T]) {
          errors[e.path as keyof T] = e.message;
        }
      });
      return { isValid: false, errors };
    }
    return { isValid: false, errors: {} };
  }
}
