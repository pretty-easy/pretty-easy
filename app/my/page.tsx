"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { subscribeClientPush, pushResultMessage } from "@/lib/push";
import BottomNav from "../nav";
import { BellIcon, EditIcon, PlusIcon } from "@/lib/icons";

type MyAppt = {
  cancel_token: string;
  service_name: string;
  price: number;
  price_max?: number | null;
  addons?: { name: string; price: number; price_max: number | null }[];
  starts_at: string;
  status: "pending" | "confirmed" | "cancelled";
  is_past: boolean;
};
type MyData = { client_name: string; appointments: MyAppt[] };

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const MONTHS_SHORT = ["ינו'", "פבר'", "מרץ", "אפר'", "מאי", "יוני", "יולי", "אוג'", "ספט'", "אוק'", "נוב'", "דצמ'"];

function apptPrice(a: MyAppt) {
  const lo = Number(a.price) + (a.addons ?? []).reduce((s, x) => s + Number(x.price), 0);
  const hi = Number(a.price_max ?? a.price) + (a.addons ?? []).reduce((s, x) => s + Number(x.price_max ?? x.price), 0);
  return hi > lo ? `₪${lo}–${hi}` : `₪${lo}`;
}
function apptTitle(a: MyAppt) {
  const names = (a.addons ?? []).map((x) => x.name);
  return names.length ? `${a.service_name} + ${names.join(" + ")}` : a.service_name;
}

export default function MyPage() {
  const [data, setData] = useState<MyData | null | "loading" | "no-token">("loading");
  const [pushMsg, setPushMsg] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [pushOn, setPushOn] = useState(false);

  useEffect(() => {
    let t: string | null = null;
    try { t = localStorage.getItem("pe_last_token"); } catch {}
    if (!t) { setData("no-token"); return; }
    setToken(t);
    supabase.rpc("get_my_appointments", { p_token: t }).then(({ data }) => setData((data as MyData) ?? "no-token"));
    try {
      if ("Notification" in window && Notification.permission === "granted") setPushOn(true);
    } catch {}
  }, []);

  const { upcoming, past, favorite, since } = useMemo(() => {
    if (!data || data === "loading" || data === "no-token")
      return { upcoming: [] as MyAppt[], past: [] as MyAppt[], favorite: null as string | null, since: null as Date | null };
    const appts = data.appointments;
    const upcoming = appts.filter((a) => !a.is_past && a.status !== "cancelled").sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const past = appts.filter((a) => a.is_past && a.status !== "cancelled");
    const counts: Record<string, number> = {};
    past.forEach((a) => (counts[a.service_name] = (counts[a.service_name] ?? 0) + 1));
    const favorite = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const first = [...appts].sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
    return { upcoming, past, favorite, since: first ? new Date(first.starts_at) : null };
  }, [data]);

  const ready = data && data !== "loading" && data !== "no-token";

  return (
    <main className="mx-auto min-h-[100svh] max-w-md pb-28">
      <header className="flex items-center gap-3.5 border-b border-line bg-white px-6 pb-5 pt-14">
        <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-blush-100 text-2xl font-extrabold text-plum-700">
          {ready ? data.client_name.trim().charAt(0) : "👤"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xl font-extrabold leading-tight">{ready ? data.client_name : "האזור האישי שלי"}</div>
          <div className="mt-0.5 text-[13px] text-muted">
            {ready
              ? `${since ? `לקוחה מאז ${MONTHS_SHORT[since.getMonth()]} ${since.getFullYear()} · ` : ""}${past.length} ביקורים`
              : "התורים וההיסטוריה שלך"}
          </div>
        </div>
        {ready && pushOn && (
          <span className="badge-ok whitespace-nowrap"><BellIcon size={12} strokeWidth={2.5} />התראות פעילות</span>
        )}
      </header>

      {data === "loading" && <p className="p-6 text-center text-muted">טוען…</p>}

      {data === "no-token" && (
        <div className="card mx-6 mt-6 text-center">
          <p className="font-bold">עוד לא קבעת תור מהמכשיר הזה</p>
          <p className="mt-1 text-sm text-muted">אחרי התור הראשון, כל התורים וההיסטוריה שלך יופיעו כאן אוטומטית</p>
          <Link href="/?book=1" className="btn-primary mt-4 inline-block">קביעת תור ראשון</Link>
        </div>
      )}

      {ready && (
        <div className="flex flex-col gap-5 px-6 pt-5">
          <section>
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="section-title">התורים הקרובים</h2>
              <Link href="/?book=1" className="flex items-center gap-1 text-xs font-bold text-blush-600"><PlusIcon size={14} strokeWidth={2.5} />תור חדש</Link>
            </div>
            {upcoming.length === 0 ? (
              <div className="card text-center text-sm">
                <p className="text-muted">אין תור קרוב</p>
                <Link href="/?book=1" className="btn-primary mt-3 inline-block">קבעי תור</Link>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {upcoming.map((a, i) => {
                  const d = new Date(a.starts_at);
                  const first = i === 0;
                  return (
                    <div key={a.cancel_token} className={`card flex items-center gap-3.5 !px-4.5 !py-4 ${first ? "shadow-card" : "shadow-none"}`}>
                      <div className={`w-[54px] shrink-0 rounded-2xl py-2 text-center ${first ? "bg-plum-700 text-white" : "bg-blush-50 text-plum-700"}`}>
                        <div className={`text-[11px] ${first ? "opacity-85" : "text-muted"}`}>{DAY_NAMES[d.getDay()]}</div>
                        <div className="text-xl font-extrabold leading-none">{d.getDate()}</div>
                        <div className={`text-[10px] ${first ? "opacity-85" : "text-muted"}`}>{MONTHS_SHORT[d.getMonth()]}</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[15px] font-extrabold">{apptTitle(a)}</div>
                        <div className="text-[13px] text-muted">{d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })} · {apptPrice(a)}</div>
                        <div className="mt-1.5">
                          {a.status === "confirmed" ? <span className="badge-ok">מאושר ✓</span> : <span className="badge-wait">ממתין לאישור</span>}
                        </div>
                      </div>
                      <Link href={`/cancel/${a.cancel_token}`} aria-label="שינוי או ביטול" className="icon-btn !h-10 !w-10 !rounded-xl text-plum-700">
                        <EditIcon size={18} />
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {token && !pushOn && (
            <div>
              <button className="btn-outline w-full !rounded-full !py-3.5" disabled={pushMsg === "ההתראות הופעלו ✓"}
                onClick={async () => { const r = await subscribeClientPush(token); setPushMsg(pushResultMessage(r)); if (r === "granted") setPushOn(true); }}>
                <BellIcon size={18} />הפעלת עדכונים ותזכורות
              </button>
              {pushMsg && <p className="mt-2 text-center text-xs text-muted">{pushMsg}</p>}
            </div>
          )}

          {past.length > 0 && (
            <section>
              <div className="mb-2.5 flex items-center justify-between">
                <h2 className="section-title">היסטוריה</h2>
                {favorite && <span className="text-xs text-muted">הטיפול הקבוע: <b className="text-plum-700">{favorite}</b></span>}
              </div>
              <div className="card divide-y divide-blush-50 !p-0 text-sm">
                {past.map((a) => (
                  <div key={a.cancel_token} className="flex items-center justify-between px-4.5 py-3.5" style={{ paddingInline: 18 }}>
                    <div>
                      <div className="font-bold">{apptTitle(a)}</div>
                      <div className="text-xs text-muted">{new Date(a.starts_at).toLocaleDateString("he-IL", { day: "numeric", month: "long" })}</div>
                    </div>
                    <span className="font-bold text-plum-500">{apptPrice(a)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
      <BottomNav active="my" />
    </main>
  );
}
