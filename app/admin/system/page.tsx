import { prisma } from "@/lib/prisma";
import { STRIPE_PRICES } from "@/lib/stripe";
import { emailConfigured } from "@/lib/email";
import { Empty, PageHead, Panel, Pill, Table, Td, ago } from "@/components/admin/ui";

export const metadata = { title: "System" };

/** Presence only: values are never rendered. */
function configChecks() {
  const has = (k: string) => !!process.env[k];
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const pub = process.env.SILO_PUBLIC_URL ?? "";
  return [
    { label: "Site URL (NEXT_PUBLIC_SITE_URL)", ok: !!site, detail: site || "Not set — links fall back to https://heysilo.co" },
    { label: "Connector API URL (SILO_PUBLIC_URL)", ok: true, detail: pub || "Not set — each download uses the address it was downloaded from" },
    { label: "Auth secret (AUTH_SECRET)", ok: has("AUTH_SECRET"), detail: has("AUTH_SECRET") ? "Set" : "Missing — sessions will fail" },
    { label: "Database (DATABASE_URL)", ok: has("DATABASE_URL"), detail: has("DATABASE_URL") ? "Set" : "Missing" },
    { label: "Stripe secret key", ok: has("STRIPE_SECRET_KEY"), detail: has("STRIPE_SECRET_KEY") ? (process.env.STRIPE_SECRET_KEY!.startsWith("sk_live") ? "Live mode" : "Test mode") : "Missing — checkout disabled" },
    { label: "Stripe webhook secret", ok: has("STRIPE_WEBHOOK_SECRET"), detail: has("STRIPE_WEBHOOK_SECRET") ? "Set" : "Missing — subscriptions will not sync" },
    { label: "Stripe prices", ok: Object.values(STRIPE_PRICES).every(Boolean), detail: `${Object.values(STRIPE_PRICES).filter(Boolean).length}/6 configured` },
    { label: "Cron secret (CRON_SECRET)", ok: has("CRON_SECRET"), detail: has("CRON_SECRET") ? "Set" : "Missing — scheduled jobs refuse to run" },
    { label: "Email (RESEND_API_KEY + EMAIL_FROM)", ok: emailConfigured(), detail: emailConfigured() ? "Password reset emails on" : "Not set — password reset by email is off" },
    { label: "Admins (ADMIN_EMAILS)", ok: true, detail: process.env.ADMIN_EMAILS ? `${process.env.ADMIN_EMAILS.split(",").filter(Boolean).length} address(es)` : "Not set — admins come from the database role only" },
  ];
}

export default async function AdminSystem() {
  const [runs, counts] = await Promise.all([
    prisma.cronRun.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
    Promise.all([
      prisma.user.count(),
      prisma.store.count(),
      prisma.event.count(),
      prisma.warmupJob.count(),
      prisma.metric.count(),
      prisma.invoice.count(),
      prisma.auditLog.count(),
    ]),
  ]);
  const tables = ["Users", "Stores", "Events", "Warmup jobs", "Daily metrics", "Invoices", "Audit entries"];

  return (
    <div className="space-y-6">
      <PageHead title="System" intro="Configuration, scheduled jobs and database size." />

      <Panel title="Configuration" intro="Environment variables are checked for presence; values are never shown.">
        <Table head={["Setting", "State", "Detail"]} minWidth={640}>
          {configChecks().map((c) => (
            <tr key={c.label}>
              <Td>{c.label}</Td>
              <Td>{c.ok ? <Pill tone="mint">ok</Pill> : <Pill tone="rose">missing</Pill>}</Td>
              <Td dim>{c.detail}</Td>
            </tr>
          ))}
        </Table>
      </Panel>

      <Panel title="Scheduled job runs" intro="Last 40 runs, newest first. Defined in vercel.json.">
        {runs.length === 0 ? (
          <Empty>No runs recorded yet. They appear after the next Vercel Cron invocation.</Empty>
        ) : (
          <Table head={["When", "Job", "Result", "Took", "Output"]}>
            {runs.map((r) => (
              <tr key={r.id}>
                <Td dim>{ago(r.createdAt)}</Td>
                <Td mono>{r.name}</Td>
                <Td>{r.ok ? <Pill tone="mint">ok</Pill> : <Pill tone="rose">failed</Pill>}</Td>
                <Td mono dim>{r.ms} ms</Td>
                <Td dim className="max-w-[420px] truncate font-mono text-[12px]">{r.detail ? JSON.stringify(r.detail) : "—"}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <Panel title="Database">
        <Table head={["Table", "Rows"]} minWidth={320}>
          {tables.map((t, i) => (
            <tr key={t}>
              <Td>{t}</Td>
              <Td mono>{counts[i].toLocaleString()}</Td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
