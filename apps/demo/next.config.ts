import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['pdfjs-reader-core'],
  webpack: (config) => {
    // Handle pdf.js worker
    config.resolve.alias.canvas = false;

    return config;
  },
};

export default nextConfig;
