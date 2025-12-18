/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true, 
  },
  eslint: {
    ignoreDuringBuilds: true, 
  },
  webpack: (config) => {
    config.ignoreWarnings = [
      { module: /node_modules/ },
      { message: /font/ },
    ];
    return config;
  },
};

export default nextConfig;