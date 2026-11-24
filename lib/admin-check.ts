/** Admins: role "admin" in the database, or an address listed in ADMIN_EMAILS (comma separated). No imports: safe anywhere. */
export function isAdmin(user: { email?: string | null; role?: string | null } | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (!user.email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(user.email.toLowerCase());
}
