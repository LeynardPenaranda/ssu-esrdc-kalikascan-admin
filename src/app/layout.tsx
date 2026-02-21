import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "./providers";
import AuthRedirect from "@/src/components/AuthRedirect";
import { ToastProvider } from "../hooks/useToast";

const poppins = localFont({
  src: [
    { path: "./fonts/Poppins-Light.ttf", weight: "300", style: "normal" },
    { path: "./fonts/Poppins-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/Poppins-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-poppins",
  display: "swap",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${poppins.variable} font-sans antialiased h-full`}>
        <AuthProvider>
          <ToastProvider>
            <AuthRedirect />
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
