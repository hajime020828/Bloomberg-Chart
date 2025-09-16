// next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // WebSocket接続のための設定
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "connect-src 'self' ws://localhost:8765 wss://localhost:8765"
          }
        ]
      }
    ]
  }
}

module.exports = nextConfig