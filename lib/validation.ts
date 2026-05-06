/**
 * lib/validation.ts
 *
 * Pure validation functions — no DOM, no side-effects.
 * All return { ok: true } or { ok: false, message: string }
 */

type ValidationResult = { ok: true } | { ok: false; message: string }

export function validateMobile(value: string): ValidationResult {
  const cleaned = value.replace(/[\s\-+]/g, '')
  if (cleaned.length === 10 && /^[6-9]\d{9}$/.test(cleaned)) return { ok: true }
  if (cleaned.length === 12 && /^91[6-9]\d{9}$/.test(cleaned)) return { ok: true }
  return { ok: false, message: 'Enter a valid 10-digit mobile number (starting with 6–9)' }
}

export function validateGSTNumber(value: string): ValidationResult {
  if (!value) return { ok: true }   // optional field
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
  if (gstRegex.test(value.toUpperCase())) return { ok: true }
  return { ok: false, message: 'Invalid GST. Example: 22AAAAA0000A1Z5' }
}

export function validateEmail(value: string): ValidationResult {
  if (!value) return { ok: true }   // optional field
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (emailRegex.test(value)) return { ok: true }
  return { ok: false, message: 'Enter a valid email address' }
}

export function validatePAN(value: string): ValidationResult {
  if (!value) return { ok: true }   // optional field
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
  if (panRegex.test(value.toUpperCase())) return { ok: true }
  return { ok: false, message: 'Invalid PAN. Example: ABCDE1234F' }
}

export function validateRequired(value: string, fieldName: string): ValidationResult {
  if (value.trim().length > 0) return { ok: true }
  return { ok: false, message: `${fieldName} is required` }
}

export function validateMinLength(
  value: string,
  min: number,
  fieldName: string
): ValidationResult {
  if (value.trim().length >= min) return { ok: true }
  return { ok: false, message: `${fieldName} must be at least ${min} characters` }
}

export function validateMaxLength(
  value: string,
  max: number,
  fieldName: string
): ValidationResult {
  if (value.trim().length <= max) return { ok: true }
  return { ok: false, message: `${fieldName} must not exceed ${max} characters` }
}

export function validatePassword(value: string): ValidationResult {
  if (value.length < 8) return { ok: false, message: 'Password must be at least 8 characters' }
  return { ok: true }
}

/** Normalise a mobile number to 10 digits (strips country code) */
export function normaliseMobile(value: string): string {
  const cleaned = value.replace(/[\s\-+]/g, '')
  if (cleaned.length === 12 && cleaned.startsWith('91')) return cleaned.slice(2)
  return cleaned
}
