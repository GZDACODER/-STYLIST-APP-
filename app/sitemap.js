// sitemap.xml: the public pages, so search engines find them.
import { publicSiteUrl } from "@/lib/siteUrl";

export default function sitemap() {
  const base = publicSiteUrl("https://www.clientelesuite.com");
  const page = (path, priority, changeFrequency = "monthly") => ({ url: `${base}${path}`, changeFrequency, priority });
  return [
    page("", 1, "weekly"),
    page("/switch", 0.8),
    page("/find", 0.7, "daily"),
    page("/signup", 0.7),
    page("/login", 0.3, "yearly"),
    page("/terms", 0.2, "yearly"),
    page("/privacy", 0.2, "yearly"),
  ];
}
