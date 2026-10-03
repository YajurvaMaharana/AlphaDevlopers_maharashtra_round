import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@fairdrop/shared'],
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@fairdrop/shared': path.resolve(__dirname, '../../packages/shared/dist/src/index.js'),
      '@noble/hashes/sha256': path.resolve(__dirname, 'node_modules/@noble/hashes/sha2.js'),
      '@noble/hashes/utils': path.resolve(__dirname, 'node_modules/@noble/hashes/utils.js'),
    };
    if (isServer) {
      config.resolve.alias['msw/browser'] = false;
    }
    return config;
  },
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    return [
      {
        source: '/backend-api/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
