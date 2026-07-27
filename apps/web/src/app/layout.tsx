import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { HelpCenter } from '@/components/help-center';
import { BusinessAnalyticsTracker } from '@/components/business-analytics-tracker';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  metadataBase: new URL('https://empleado24.com'),
  title: 'Empleado24 | Contrata empleados con IA desde 97 €/mes',
  description: 'Contrata una Recepcionista IA o un Especialista Email IA para tu empresa. Trabajan 24 horas al día y pueden empezar en menos de 5 minutos.',
  alternates: { canonical: '/' },
  icons: { icon: '/icon.svg', shortcut: '/icon.svg', apple: '/icon.svg' },
  openGraph: { title: 'Empleado24 — Contrata empleados con IA para tu empresa', description: 'Recepcionista IA y Especialista Email IA desde 97 €/mes. Incorporación guiada en menos de 5 minutos.', type: 'website', locale: 'es_ES', url: 'https://empleado24.com', siteName: 'Empleado24' },
  twitter: { card: 'summary_large_image', title: 'Empleado24 | Empleados con IA', description: 'Contrata tu primer empleado con IA desde 97 €/mes.' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const schema={
    '@context':'https://schema.org',
    '@graph':[
      {'@type':'Organization',name:'Empleado24',url:'https://empleado24.com',description:'Empleados con IA para empresas'},
      {'@type':'WebSite',name:'Empleado24',url:'https://empleado24.com',inLanguage:'es'},
      {'@type':'ItemList',name:'Empleados con IA disponibles',itemListElement:[
        {'@type':'ListItem',position:1,item:{'@type':'Product',name:'Recepcionista IA',description:'Atiende llamadas y organiza citas para tu empresa',offers:{'@type':'Offer',price:'97',priceCurrency:'EUR',availability:'https://schema.org/InStock',url:'https://empleado24.com/#empleados'}}},
        {'@type':'ListItem',position:2,item:{'@type':'Product',name:'Especialista Email IA',description:'Organiza contactos, mensajes y campañas de email para tu empresa',offers:{'@type':'Offer',price:'97',priceCurrency:'EUR',availability:'https://schema.org/InStock',url:'https://empleado24.com/#empleados'}}},
      ]},
    ],
  };
  return <html lang="es" suppressHydrationWarning className={`${geist.variable} ${mono.variable}`}><body>{children}<BusinessAnalyticsTracker /><HelpCenter /><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/></body></html>;
}
