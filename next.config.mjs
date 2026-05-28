/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'mammoth', '@anthropic-ai/sdk'],
  },
};

export default nextConfig;
