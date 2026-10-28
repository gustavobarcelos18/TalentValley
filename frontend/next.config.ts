import type { NextConfig } from "next";

function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === "/") end--;
  return value.slice(0, end);
}

const rawBackendApiUrl = process.env.BACKEND_API_URL;
const backendApiUrl = rawBackendApiUrl && trimTrailingSlashes(rawBackendApiUrl);

const nextConfig: NextConfig = {
  async rewrites() {
    if (!backendApiUrl) return [];

    return [
      {
        source: "/api/:path*",
        destination: `${backendApiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
