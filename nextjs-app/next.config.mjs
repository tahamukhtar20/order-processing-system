/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@temporalio/client', '@temporalio/common', '@temporalio/proto'],
};

export default nextConfig;
