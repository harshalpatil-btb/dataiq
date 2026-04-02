// dealiq/frontend/next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { appDir: true },
  images: {
    domains: [
      'supabase.co',
      'res.cloudinary.com',
      'avatars.githubusercontent.com',
      'lh3.googleusercontent.com',
    ],
  },
  async headers() {
    return [
      {
        // Allow deal rooms to be embedded
        source: '/room/:slug*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ]
  },
}
module.exports = nextConfig
