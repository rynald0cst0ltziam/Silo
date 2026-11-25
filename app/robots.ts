import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/utils";

const PRIVATE = ["/api/", "/login", "/dashboard", "/admin", "/sign-in", "/sign-up", "/forgot-password", "/reset-password"];

/** Search and AI crawlers may read the public site; private areas stay out of every index. */
const AI_AGENTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      ...AI_AGENTS.map((userAgent) => ({ userAgent, allow: "/", disallow: PRIVATE })),
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
