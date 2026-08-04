import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: 'https://empleado24.com', lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: 'https://empleado24.com/empresa-ia', lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: 'https://empleado24.com/demo', lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: 'https://empleado24.com/empleados/recepcionista-ia', lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://empleado24.com/empleados/especialista-email-ia', lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://empleado24.com/empleados/closer-ia', lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://empleado24.com/empleados/whatsapp-ia', lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://empleado24.com/empleados/especialista-presupuestos-ia', lastModified, changeFrequency: 'monthly', priority: 0.8 },
  ];
}
