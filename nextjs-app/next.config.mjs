/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      '@temporalio/client',
      '@temporalio/common',
      '@temporalio/proto',
    ],
  },
};

export default nextConfig;
