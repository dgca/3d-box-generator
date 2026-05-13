import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const faviconHref =
  'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📦</text></svg>';

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.VERCEL_PROJECT_PRODUCTION_URL ??
  process.env.VERCEL_URL ??
  "http://localhost:3000";

const siteOrigin = siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`;

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: "3D Box Generator",
  description:
    "A free tool for designing simple 3D-printable boxes and lids. Set the dimensions, add SVG cutouts, preview the mesh, and download STL files in your browser.",
  icons: {
    icon: faviconHref,
  },
  applicationName: "3D Box Generator",
  keywords: [
    "3D printing",
    "STL generator",
    "parametric box",
    "box generator",
    "SVG cutouts",
    "3D printable box",
  ],
  authors: [{ name: "Dan Cortes" }],
  creator: "Dan Cortes",
  openGraph: {
    title: "3D Box Generator",
    description:
      "Design simple 3D-printable boxes and lids, preview the mesh, and export STL files from your browser.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "3D Box Generator preview with a decorative cutout box.",
      },
    ],
    type: "website",
    siteName: "3D Box Generator",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "3D Box Generator",
    description:
      "A free tool for making custom 3D-printable boxes, lids, and SVG cutouts in your browser.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
