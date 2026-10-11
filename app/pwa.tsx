"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function PwaSetup() {
  const pathname = usePathname();

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  // דיווח נוכחות: מותקן במסך הבית? איזו פלטפורמה? (פעם אחת לכל פתיחה)
  useEffect(() => {
    if (pathname?.startsWith("/admin")) return;
    try {
      const token = localStorage.getItem("pe_last_token");
      if (!token) return;
      if (sessionStorage.getItem("pe_presence_sent")) return;
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true;
      const ua = navigator.userAgent;
      const platform = /iphone|ipad|ipod/i.test(ua)
        ? "ios"
        : /android/i.test(ua)
        ? "android"
        : "desktop";
      supabase
        .rpc("report_client_presence", {
          p_token: token,
          p_installed: standalone,
          p_platform: platform,
        })
        .then(() => {
          try {
            sessionStorage.setItem("pe_presence_sent", "1");
          } catch {}
        });
    } catch {}
  }, [pathname]);

  return null;
}
