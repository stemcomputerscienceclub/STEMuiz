/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      "images.unsplash.com"
    ]
  },
  reactStrictMode: true,
  onError: (err) => {
    console.error('Next.js error:', err);
  },
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
    externalResolver: true
  }
};

module.exports = nextConfig;