import type { Metadata, Viewport } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const themeInitScript = `(()=>{try{var t=localStorage.getItem("wallpapy-theme");document.documentElement.classList.remove("dark","light");if(t==="light"){document.documentElement.classList.add("light");}else{document.documentElement.classList.add("dark");}}catch(e){document.documentElement.classList.add("dark");}})();`;

export const metadata: Metadata = {
  title: "Wallpapy — Pill Wallpaper Generator",
  description: "Generate beautiful gradient pill wallpapers",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0a09",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="dark h-full min-h-dvh overflow-hidden antialiased"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${plusJakarta.variable} ${geistMono.variable} flex min-h-dvh min-h-0 flex-col overflow-hidden supports-[min-height:100dvh]:min-h-dvh text-wp-1 bg-wp-app`}
      >
        {children}
      </body>
    </html>
  );
}
