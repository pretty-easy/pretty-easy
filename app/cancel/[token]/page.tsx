"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase, Slot } from "@/lib/supabase";
import { subscribeClientPush, pushResultMessage } from "@/lib/push";
import { BellIcon, ChevronRight, RefreshIcon, XIcon, CheckIcon } from "@/lib/icons";

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const MONTHS_SHORT = ["ינו'", "פבר'", "מרץ", "אפר'", "מאי", "יוני", "יולי", "אוג'", "ספט'", "אוק'", "נוב'", "דצמ'"];

type Info = {
  service_name: string;
  service_id: string;
  starts_at: string;
  client_name: string;
  status: string;
  can_modify: boolean;
  addons?: { name: string }[];
};

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dayLabel(d: Date) {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "היום";
  if (d.toDateString() === tomorrow.toDateString()) return "מחר";
  return DAY_NAMES[d.getDay()];
}

export default function ManagePage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<Info | null | "loading">("loading");
  const [mode, setMode] = useState<"view" | "reschedule">("view");
  const [done, setDone] = useState<"cancelled" | "moved" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushMsg, setPushMsg] = useState<string | null>(null);

  const [dateStr, setDateStr] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [horizonDays, setHorizonDays] = useState(21);
  useEffect(() => {
    supabase.rpc("get_booking_horizon").then(({ data }) => {
      const d = (data as { days?: number } | null)?.days;
      if (typeof d === "number") setHorizonDays(Math.min(d, 120));
    });
  }, []);

  const days = useMemo(() => {
    const out: { date: Date; str: string }[] = [];
    for (let i = 0; i < horizonDays; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      out.push({ date: d, str: toDateStr(d) });
    }
    return out;
  }, [horizonDays]);

  const load = useCallback(() => {
    supabase.rpc("get_appointment_by_token", { p_token: token }).then(({ data }) => setInfo((data as Info) ?? null));
  }, [token]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (mode !== "reschedule" || !dateStr) return;
    setSlotsLoading(true); setSlot(null);
    supabase.rpc("get_reschedule_slots", { p_token: token, p_date: dateStr })
      .then(({ data }) => { setSlots((data as Slot[]) ?? []); setSlotsLoading(false); });
  }, [mode, dateStr, token]);

  async function cancel() {
    if (!confirm("לבטל את התור?")) return;
    setBusy(true);
    const { data } = await supabase.rpc("cancel_appointment", { p_token: token });
    setBusy(false);
    if (data) setDone("cancelled");
    else setError("לא ניתן לבטל (ייתכן שנשארו פחות מ-24 שעות לתור)");
  }

  async function move() {
    if (!slot) return;
    setBusy(true); setError(null);
    const { error } = await supabase.rpc("reschedule_appointment", { p_token: token, p_new_slot: slot.slot_start });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setDone("moved"); setMode("view"); load();
  }

  const d = info && info !== "loading" ? new Date(info.starts_at) : null;
  const title = info && info !== "loading"
    ? info.service_name + (info.addons && info.addons.length ? " + " + info.addons.map((a) => a.name).join(" + ") : "")
    : "";

  return (
    <main className="mx-auto min-h-[100svh] max-w-md pb-10">
      <header className="flex items-center justify-between px-6 pt-14">
        <Link href="/my" aria-label="חזרה" className="icon-btn text-plum-700"><ChevronRight size={20} /></Link>
        <span className="text-sm font-bold text-muted">ניהול התור</span>
        <span className="w-11" />
      </header>

      {info === "loading" && <p className="p-6 text-center text-muted">טוען…</p>}

      {info === null && (
        <div className="card mx-6 mt-6 text-center"><p>התור לא נמצא. ייתכן שהקישור שגוי.</p></div>
      )}

      {info && info !== "loading" && done === "cancelled" && (
        <div className="card mx-6 mt-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-500"><XIcon size={26} /></div>
          <h1 className="text-xl font-extrabold">התור בוטל</h1>
          <p className="mt-1 text-sm text-muted">אשמח לראות אותך בפעם אחרת 💕</p>
          <Link href="/?book=1" className="btn-primary mt-4 inline-block">קביעת תור חדש</Link>
        </div>
      )}

      {info && info !== "loading" && info.status === "cancelled" && done !== "cancelled" && (
        <div className="card mx-6 mt-6 text-center">
          <h1 className="text-xl font-extrabold">התור הזה בוטל</h1>
          <Link href="/?book=1" className="btn-primary mt-4 inline-block">קביעת תור חדש</Link>
        </div>
      )}

      {info && info !== "loading" && info.status !== "cancelled" && done !== "cancelled" && d && (
        <div className="flex flex-col gap-4 px-6 pt-5">
          {done === "moved" && (
            <div className="flex items-center gap-2 rounded-2xl bg-success-50 px-4 py-3 text-sm font-bold text-success">
              <CheckIcon size={18} strokeWidth={2.5} />התור עודכן – ממתין לאישור מחדש
            </div>
          )}

          <div className="card shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted">היי {info.client_name.split(" ")[0]}, התור שלך</span>
              {info.status === "pending" ? <span className="badge-wait">ממתין לאישור</span> : <span className="badge-ok">מאושר ✓</span>}
            </div>
            <div className="mt-3 flex items-center gap-3.5">
              <div className="w-[60px] shrink-0 rounded-2xl bg-plum-700 py-2.5 text-center text-white">
                <div className="text-[11px] opacity-85">{DAY_NAMES[d.getDay()]}</div>
                <div className="text-2xl font-extrabold leading-none">{d.getDate()}</div>
                <div className="text-[10px] opacity-85">{MONTHS_SHORT[d.getMonth()]}</div>
              </div>
              <div className="min-w-0">
                <div className="text-[17px] font-extrabold">{title}</div>
                <div className="text-sm text-muted">בשעה {d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
            </div>

            {info.can_modify ? (
              mode === "view" && (
                <div className="mt-4 flex gap-2">
                  <button className="btn-outline flex-1" onClick={() => setMode("reschedule")}><RefreshIcon size={16} />שינוי מועד</button>
                  <button className="btn-outline flex-1 !text-danger" onClick={cancel} disabled={busy}><XIcon size={16} />{busy ? "מבטל…" : "ביטול התור"}</button>
                </div>
              )
            ) : (
              <p className="mt-4 rounded-2xl bg-blush-50 px-4 py-3 text-sm text-plum-500">נשארו פחות מ-24 שעות לתור, אז שינוי או ביטול אפשריים רק בטלפון 💕</p>
            )}
            {error && mode === "view" && <p className="mt-3 rounded-2xl bg-danger-50 p-3 text-sm text-danger">{error}</p>}
          </div>

          {mode === "reschedule" && info.can_modify && (
            <div className="card">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="section-title">בחרי מועד חדש</h2>
                <button className="btn-ghost text-sm" onClick={() => setMode("view")}>סגירה</button>
              </div>
              <div className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1">
                {days.map((x) => {
                  const on = dateStr === x.str;
                  return (
                    <button key={x.str} onClick={() => setDateStr(x.str)}
                      className={`flex h-[68px] min-w-[58px] flex-col items-center justify-center rounded-2xl border transition ${on ? "border-plum-700 bg-plum-700 text-white shadow-plum" : "border-line bg-white"}`}>
                      <span className={`text-[11px] font-semibold ${on ? "opacity-85" : "text-muted"}`}>{dayLabel(x.date)}</span>
                      <span className="text-lg font-extrabold">{x.date.getDate()}</span>
                    </button>
                  );
                })}
              </div>
              {dateStr && (slotsLoading ? (
                <p className="text-sm text-muted">בודק שעות…</p>
              ) : slots.length === 0 ? (
                <p className="rounded-2xl bg-blush-50 p-3 text-sm">אין שעות פנויות ביום זה – נסי יום אחר</p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {slots.map((sl) => {
                    const on = slot?.slot_start === sl.slot_start;
                    return (
                      <button key={sl.slot_start} onClick={() => setSlot(sl)}
                        className={`h-11 rounded-2xl border text-sm transition ${on ? "border-plum-700 bg-plum-700 font-bold text-white shadow-plum" : "border-line bg-white font-semibold"}`}>
                        {sl.label}
                      </button>
                    );
                  })}
                </div>
              ))}
              {error && <p className="mt-3 rounded-2xl bg-danger-50 p-3 text-sm text-danger">{error}</p>}
              <button className="btn-primary mt-4 w-full" disabled={!slot || busy} onClick={move}>
                {busy ? "מעדכנת…" : "אישור המועד החדש"}
              </button>
            </div>
          )}

          <button className="btn-outline w-full !rounded-full !py-3.5" disabled={pushMsg === "ההתראות הופעלו ✓"}
            onClick={async () => { const r = await subscribeClientPush(token); setPushMsg(pushResultMessage(r)); }}>
            <BellIcon size={18} />{pushMsg === "ההתראות הופעלו ✓" ? "ההתראות הופעלו ✓" : "הפעלת תזכורת יום לפני התור"}
          </button>
          {pushMsg && pushMsg !== "ההתראות הופעלו ✓" && <p className="text-center text-xs text-muted">{pushMsg}</p>}
        </div>
      )}
    </main>
  );
}
