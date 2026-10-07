"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";

type BIPEvent = Event & { prompt: () => Promise<void> };

const SNOOZE_KEY = "pe_a2hs_until";
const SNOOZE_DAYS = 7;

export default function AddToHomeScreen() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [installEvt, setInstallEvt] = useState<BIPEvent | null>(null);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (pathname?.startsWith("/admin")) return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    // רק מובייל
    const mobile = /iphone|ipad|ipod|android/i.test(navigator.userAgent);
    if (!mobile) return;

    try {
      const until = Number(localStorage.getItem(SNOOZE_KEY) || 0);
      if (Date.now() < until) return;
    } catch {}

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIos(ios);

    const onBip = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    const t = setTimeout(() => setShow(true), 2500);
    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onBip);
    };
  }, [pathname]);

  function snooze() {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 864e5));
    } catch {}
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-md rounded-2xl border border-blush-200 bg-white p-4 shadow-xl">
        <div className="flex items-start gap-3">
          <Image
            src="/icon-192.png"
            alt=""
            width={48}
            height={48}
            className="rounded-xl"
          />
          <div className="flex-1 text-sm">
            <p className="font-bold">שמרי את Pretty Easy במסך הבית 💅</p>
            <p className="text-plum-500">
              {isIos
                ? "לחצי על כפתור השיתוף ← ואז ״הוספה למסך הבית״ – ככה תקבלי גם עדכונים על התורים"
                : "גישה בלחיצה אחת + עדכונים על התורים שלך"}
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          {!isIos && installEvt && (
            <button
              className="btn-primary flex-1 !py-2 text-sm"
              onClick={async () => {
                await installEvt.prompt();
                snooze();
              }}
            >
              הוספה למסך הבית
            </button>
          )}
          {isIos && (
            <div className="flex-1 rounded-full bg-blush-100 px-3 py-2 text-center text-xs">
              שיתוף <span className="inline-block">⎋</span> ← הוספה למסך הבית ➕
            </div>
          )}
          <button className="btn-ghost text-sm" onClick={snooze}>
            לא עכשיו
          </button>
        </div>
      </div>
    </div>
  );
}
