import type { Metadata } from "next";
import "./globals.css";
export const metadata:Metadata={title:"2026-2027 Akademik Yılı SKS Etkinlik Stüdyosu",description:"SKS etkinliklerini Excel’den mail, Instagram post, story ve haftalık özet tasarımlarına dönüştürün."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="tr"><body>{children}</body></html>}
