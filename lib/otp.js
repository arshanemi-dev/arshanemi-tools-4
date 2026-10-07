import { randomInt } from 'node:crypto'

// A 6-digit one-time code. From the OS's cryptographic generator — a code
// that guards a sign-in or a password reset must not come from Math.random(),
// whose output can be predicted from earlier values.
export function generateOTP() {
  return String(randomInt(100000, 1000000))
}
