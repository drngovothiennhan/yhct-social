import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'YHCT Social',
    short_name: 'YHCT Social',
    description: 'Cộng đồng Y học Cổ truyền — chia sẻ học thuật, hoạt động và kiến thức chuyên môn.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#f8faf7',
    theme_color: '#245c45',
    lang: 'vi',
    categories: ['medical', 'education', 'social'],
  };
}
