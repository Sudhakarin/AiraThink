import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Airalance',
    short_name: 'Airalance',
    description: 'Chat and social app to connect with people',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#000000',
    icons: [
      {
        src: '/IMG_2890.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/IMG_2891.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
