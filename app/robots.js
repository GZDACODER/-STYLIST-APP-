// robots.txt: search engines may read the public pages and pros' booking
// pages, but not dashboards, client accounts or the app's internals.
import { publicSiteUrl } from "@/lib/siteUrl";

export default function robots() {
  const base = publicSiteUrl("https://www.clientelesuite.com");
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/client", "/my", "/api", "/auth"] },
    sitemap: `${base}/sitemap.xml`,
  };
}
