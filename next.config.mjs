/** @type {import('next').NextConfig} */
const nextConfig = {
  // The fonts the shared-link preview images are drawn with (lib/og/card.js).
  outputFileTracingIncludes: {
    "/**": ["./lib/og/fonts/*.woff"],
  },
};

export default nextConfig;
