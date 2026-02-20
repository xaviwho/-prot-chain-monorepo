import { Geist, Geist_Mono } from "next/font/google";
import Navigation from "@/components/Navigation";
import ClientErrorBoundary from "@/components/ClientErrorBoundary";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "ProtChain",
  description: "Blockchain-based Protein Analysis Platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script src="https://3dmol.org/build/3Dmol-min.js"></script>
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white min-h-screen`}>
        <Navigation />
        <ClientErrorBoundary>
          <main>{children}</main>
        </ClientErrorBoundary>
      </body>
    </html>
  );
}
