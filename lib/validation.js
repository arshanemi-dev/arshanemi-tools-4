export function validatePassword(pw) {
  if (!pw || pw.length < 8)     return 'Password must be at least 8 characters'
  if (!/[A-Z]/.test(pw))        return 'Password must contain at least one uppercase letter'
  if (!/[0-9]/.test(pw))        return 'Password must contain at least one number'
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Password must contain at least one special character'
  return null
}
