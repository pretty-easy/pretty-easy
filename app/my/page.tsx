"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { subscribeClientPush, pushResultMessage } from "@/lib/push";

type MyAppt = {
  cancel_token: string;
  service_name: string;
  price: number;
  starts_at: string;
  status: "pending" | "confirmed" | "cancelled";
  is_past: boolean;
};

type MyData = { client_name: string; appointments: MyAppt[] };

const STATUS_BADGE: Record<MyAppt["status"], { text: string; cls: string }> = {
  pending: { text: "⏳ ממתין לאישור", cls: "bg-amber-100 text-amber-800" },
  confirmed: { text: "✓ מאושר", cls: "bg-green-100 text-green-800" },
  cancelled: { text: "בוטל", cls: "bg-gray-100 text-gray-500" },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MyPage() {
  const [data, setData] = useState<MyData | null | "loading" | "no-token">("loading");
  const [pushMsg, setPushMsg] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let t: string | null = null;
    try {
      t = localStorage.getItem("pe_last_token");
    } catch {}
    if (!t) {
      setData("no-token");
      return;
    }
    setToken(t);
    supabase
      .rpc("get_my_appointments", { p_token: t })
      .then(({ data }) => setData((data as MyData) ?? "no-token"));
  }, []);

  const { upcoming, past, visits, favorite } = useMemo(() => {
    if (!data || data === "loading" || data === "no-token")
      return { upcoming: [], past: [], visits: 0, favorite: null as string | null };
    const appts = data.appointments;
    const upcoming = appts
      .filter((a) => !a.is_past && a.status !== "cancelled")
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const past = appts.filter((a) => a.is_past && a.status !== "cancelled");
    const counts: Record<string, number> = {};
    past.forEach((a) => (counts[a.service_name] = (counts[a.service_name] ?? 0) + 1));
    const favorite =
      Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return { upcoming, past, visits: past.length, favorite };
  }, [data]);

  return (
    <main className="mx-auto max-w-md px-4 pb-16">
      <header className="flex flex-col items-center pt-6 pb-4">
        <Link href="/">
          <Image src="/logo.png" alt="Pretty Easy" width={180} height={54} priority />
        </Link>
      </header>

      <h1 className="mb-4 text-center text-xl font-bold">
        {data && data !== "loading" && data !== "no-token"
          ? `היי ${data.client_name} 👋`
          : "האזור האישי שלי"}
      </h1>

      {data === "loading" && <p className="text-center text-plum-500">טוען…</p>}

      {data === "no-token" && (
        <div className="card text-center">
          <p className="mb-1 font-semibold">עוד לא קבעת תור מהמכשיר הזה</p>
          <p className="mb-4 text-sm text-plum-500">
            אחרי התור הראשון, כל התורים וההיסטוריה שלך יופיעו כאן אוטומטית
          </p>
          <Link href="/" className="btn-primary inline-block">
            קביעת תור ראשון ✨
          </Link>
        </div>
      )}

      {data && data !== "loading" && data !== "no-token" && (
        <div className="flex flex-col gap-4">
          {/* סטטיסטיקה */}
          {visits > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="card py-4 text-center">
                <div className="text-2xl font-bold text-blush-600">{visits}</div>
                <div className="text-xs text-plum-500">ביקורים</div>
              </div>
              <div className="card py-4 text-center">
                <div className="truncate text-lg font-bold">{favorite ?? "–"}</div>
                <div className="text-xs text-plum-500">הטיפול הקבוע שלך</div>
              </div>
            </div>
          )}

          {/* תורים קרובים */}
          <section>
            <h2 className="mb-2 font-bold">התורים הקרובים שלך</h2>
            {upcoming.length === 0 ? (
              <div className="card text-center text-sm">
                <p className="mb-3 text-plum-500">אין תור קרוב</p>
                <Link href="/" className="btn-primary inline-block">
                  קבעי תור ✨
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {upcoming.map((a) => (
                  <div key={a.cancel_token} className="card">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-semibold">{a.service_name}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[a.status].cls}`}
                      >
                        {STATUS_BADGE[a.status].text}
                      </span>
                    </div>
                    <p className="mb-3 text-sm text-plum-500">{fmt(a.starts_at)}</p>
                    <Link
                      href={`/cancel/${a.cancel_token}`}
                      className="btn-ghost inline-block border border-blush-200 text-sm"
                    >
                      שינוי או ביטול
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* תזכורות */}
          {token && (
            <div>
              <button
                className="btn-ghost w-full border border-blush-200"
                disabled={pushMsg === "ההתראות הופעלו ✓"}
                onClick={async () => {
                  const r = await subscribeClientPush(token);
                  setPushMsg(pushResultMessage(r));
                }}
              >
                🔔 הפעלת עדכונים ותזכורות
              </button>
              {pushMsg && (
                <p className="mt-2 text-center text-xs text-plum-500">{pushMsg}</p>
              )}
            </div>
          )}

          {/* היסטוריה */}
          {past.length > 0 && (
            <section>
              <h2 className="mb-2 font-bold">היסטוריית ביקורים</h2>
              <div className="card divide-y divide-blush-100 !p-0 text-sm">
                {past.map((a) => (
                  <div
                    key={a.cancel_token}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div>
                      <div className="font-medium">{a.service_name}</div>
                      <div className="text-xs text-plum-500">
                        {new Date(a.starts_at).toLocaleDateString("he-IL", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                    <span className="text-plum-500">₪{Number(a.price)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
