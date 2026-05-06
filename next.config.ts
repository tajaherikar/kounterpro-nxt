import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Static export — required for Capacitor (file:// protocol)
  output: 'export',
  // Trailing slash ensures Capacitor's file:// routing resolves correctly
  trailingSlash: true,
  // Disable the default image optimisation (not supported in static export)
  images: {
    unoptimized: true,
  },
}

export default nextConfig
