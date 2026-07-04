export function normalizePhone(tel: string | null | undefined): string | null {
  if (!tel) return null;
  const digits = tel.replace(/[^0-9]/g, "").replace(/^33/, "0");
  return digits.length === 10 ? digits : tel.trim() || null;
}

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.trim().toLowerCase() || null;
}
