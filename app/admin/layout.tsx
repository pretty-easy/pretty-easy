import type { Metadata } from "next";

// מניפסט נפרד לאדמין: שמירה למסך הבית מתוך /admin יוצרת אפליקציית "ניהול"
// שנפתחת ישר ליומן (ולא לדף הלקוחות)
export const metadata: Metadata = {
  title: "Pretty Easy – ניהול",
  manifest: "/manifest-admin.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ניהול",
  },
  icons: {
    icon: "/icon-admin-192.png",
    apple: "/apple-touch-icon-admin.png",
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
