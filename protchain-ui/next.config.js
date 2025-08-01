/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://localhost:8082/api/v1/:path*',
      },
      {
        source: '/auth/:path*',
        destination: 'http://localhost:8082/auth/:path*',
      },
    ]
  },
  webpack: (config, { isServer }) => {
    // Fix for electron-fetch and other electron modules in browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        electron: false,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        os: false,
        url: false,
        assert: false,
      };
      
      // Add module resolution aliases to prevent electron-fetch from loading
      config.resolve.alias = {
        ...config.resolve.alias,
        'electron-fetch': false,
        'electron': false,
      };
    }
    
    // Exclude problematic modules from bundling
    config.externals = config.externals || [];
    if (!isServer) {
      config.externals.push({
        electron: 'electron',
        'electron-fetch': 'electron-fetch',
      });
    }
    
    // Ignore specific modules that cause issues
    const webpack = require('webpack');
    config.plugins = config.plugins || [];
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^electron$/,
      })
    );
    
    return config;
  },
}

module.exports = nextConfig
