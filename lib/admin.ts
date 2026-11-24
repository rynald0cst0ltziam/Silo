import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin-check";

export { isAdmin };

/** For admin pages: anyone else gets a 404-equivalent redirect, never a hint the console exists. */
export async function requireAdminPage() {
  const user = await getUser();
  if (!user) redirect("/sign-in");
  if (!isAdmin(user)) redirect("/dashboard");
  return user;
}

/** For admin API routes. */
export async function getAdmin() {
  const user = await getUser();
  return user && isAdmin(user) ? user : null;
}
