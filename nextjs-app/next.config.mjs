/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: [
      '@temporalio/client',
      '@temporalio/common',
      '@temporalio/proto',
    ],
  },
};

export default nextConfig;
