// Default tenant company + admin accounts, seeded by scripts/seed.mjs.
// These are convenience defaults for a fresh environment — change the
// passwords after first login (both accounts can update their own password
// from Admin → Profile, or a master_admin can reset either from Admin → Users).

export const DEFAULT_COMPANY = {
  name: 'Barmeto',
  email: 'support@barmeto.com',
  phone: '+91 98765 43210',
  website: 'https://www.barmeto.com',
  address: 'Barmeto HQ, Tech Park, Surat, Gujarat 395007',
};

// Full platform access — seeded/updated only by this script (never created
// through the admin UI).
export const MASTER_ADMIN = {
  name: 'Master Admin',
  email: 'barmeto@gmail.com',
  password: 'Admin@1234',
};

// Company-scoped admin for DEFAULT_COMPANY.
export const DEFAULT_COMPANY_ADMIN = {
  name: 'Jikishorji',
  email: 'jikishorji@gmail.com',
  password: 'India@123',
  role: 'admin',
};
