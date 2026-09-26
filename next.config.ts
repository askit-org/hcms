import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const apiUrl = process.env.NEXT_PUBLIC_API_URL;

// The frontend has no API routes of its own — it must be pointed at the backend explicitly.
if (isProd && !apiUrl) {
  throw new Error(
    "NEXT_PUBLIC_API_URL must be set for production builds (e.g. https://api.example.com/api)."
  );
}

function originOf(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).origin;
  } catch {
    if (isProd) {
      throw new Error(`NEXT_PUBLIC_API_URL must be an absolute URL, got "${url}".`);
    }
    return "";
  }
}

const apiOrigin = originOf(apiUrl);

const RAZORPAY_CHECKOUT = "https://checkout.razorpay.com";

const cspDirectives: Record<string, string[]> = {
  "default-src": ["'self'"],
  "script-src": ["'self'", "'unsafe-inline'", RAZORPAY_CHECKOUT, ...(isProd ? [] : ["'unsafe-eval'"])],
  // next/font self-hosts Google Fonts, so no external font/style origins are needed
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:", "blob:", "https:"],
  "font-src": ["'self'", "data:"],
  "connect-src": ["'self'", apiOrigin, "https://*.razorpay.com", ...(isProd ? [] : ["ws:", "wss:"])].filter(Boolean),
  "frame-src": ["https://api.razorpay.com", RAZORPAY_CHECKOUT],
  "worker-src": ["'self'"],
  "manifest-src": ["'self'"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
};

const contentSecurityPolicy = Object.entries(cspDirectives)
  .map(([directive, sources]) => `${directive} ${sources.join(" ")}`)
  .join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          {
            key: "Permissions-Policy",
            value: 'microphone=(self), camera=(), geolocation=(), payment=(self "https://checkout.razorpay.com")',
          },
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
