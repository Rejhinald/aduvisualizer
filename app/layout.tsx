import type { Metadata } from "next";
import { Montserrat, Open_Sans } from "next/font/google";
import "./globals.css";
import { AnimatedBackground } from "../components/animated-background";

const montserratBold = Montserrat({
  variable: "--font-montserrat-bold",
  subsets: ["latin"],
  weight: ["700"],
});

const montserratRegular = Montserrat({
  variable: "--font-montserrat-regular",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "ADU Visualizer | Design & Visualize Your Accessory Dwelling Unit",
    template: "%s | ADU Visualizer"
  },
  description: "Design your perfect ADU with our interactive 2D floor planner, choose custom finishes, and visualize your space with AI-powered 3D rendering. Create, customize, and bring your accessory dwelling unit to life.",
  keywords: [
    "ADU visualizer",
    "ADU design tool",
    "accessory dwelling unit planner",
    "2D floor plan creator",
    "3D ADU visualization",
    "AI rendering",
    "ADU floor plan",
    "backyard cottage design",
    "granny flat planner",
    "ADU customization",
    "virtual ADU design"
  ],
  authors: [{ name: "Avorino", url: "https://avorino.com" }],
  creator: "Avorino",
  publisher: "Avorino",
  category: "Design & Planning",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://visualizer.avorino.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'ADU Visualizer | Design & Visualize Your Accessory Dwelling Unit',
    description: 'Design your perfect ADU with interactive 2D floor planning, custom finish selection, and AI-powered 3D visualization. Create, customize, and bring your accessory dwelling unit to life.',
    url: 'https://visualizer.avorino.com',
    siteName: 'ADU Visualizer by Avorino',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'ADU Visualizer - Design and visualize your accessory dwelling unit',
        type: 'image/jpeg',
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

// Structured Data
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "name": "ADU Visualizer",
      "url": "https://visualizer.avorino.com",
      "description": "Interactive ADU design tool with 2D floor planning, finish selection, and AI-powered 3D visualization for accessory dwelling units.",
      "applicationCategory": "DesignApplication",
      "operatingSystem": "Any",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      },
      "creator": {
        "@type": "Organization",
        "name": "Avorino",
        "url": "https://avorino.com"
      }
    },
    {
      "@type": "Service",
      "serviceType": "ADU Design & Visualization",
      "provider": {
        "@type": "Organization",
        "name": "Avorino"
      },
      "areaServed": {
        "@type": "Country",
        "name": "United States"
      },
      "hasOfferCatalog": {
        "@type": "OfferCatalog",
        "name": "ADU Design Services",
        "itemListElement": [
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "2D Floor Plan Design"
            }
          },
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "Finish & Material Selection"
            }
          },
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "AI-Powered 3D Visualization"
            }
          }
        ]
      }
    }
  ]
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#961818" />
      </head>
      <body className={`${montserratBold.variable} ${montserratRegular.variable} ${openSans.variable} antialiased`}>
        <div className="min-h-screen relative">
          {/* Animated Background */}
          <AnimatedBackground />

          <main className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 md:py-12 lg:py-16">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
