import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: 'https://empleado24.com', lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: 'https://empleado24.com/empleados/recepcionista', lastModified, changeFrequency: 'monthly', priority: 0.8 },
  ];
}
