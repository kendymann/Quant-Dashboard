/** @type {import('next').NextConfig} */
const nextConfig = {
    // Enables the "secret sauce" for Docker: standalone mode
    output: 'standalone', 
    
    // Ensures your app works correctly behind the Coolify proxy
    images: {
      unoptimized: true,
    },
  }
  
  module.exports = nextConfig