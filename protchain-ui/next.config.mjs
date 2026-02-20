/** @type {import('next').NextConfig} */
const nextConfig = {
  // Blockchain env vars are read from .env.local at runtime via process.env
  // Do NOT hardcode secrets here — they get baked into the client bundle

  // Enable standalone output for Docker production builds
  output: 'standalone',
};

export default nextConfig;
