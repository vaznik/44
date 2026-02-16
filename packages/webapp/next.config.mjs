/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // Cloudflare Pages static export
  images: { unoptimized: true },
};
export default nextConfig;
