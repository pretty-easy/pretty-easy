"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { supabase, Slot } from "@/lib/supabase";
import { subscribeClientPush, pushResultMessage } from "@/lib/push";

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

type Info = {
  service_name: string;
  service_id: string;
  starts_at: string;
  client_name: string;
  status: string;
  can_modify: boolean;
};

function toDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

  // להזזה
  const [dateStr, setDateStr] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const days = useMemo(() => {
    const out: { date: Date; str: string }[] = [];
    for (let i = 0; i < 21; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      out.push({ date: d, str: toDateStr(d) });
    }
    return out;
  }, []);

  const load = useCallback(() => {
    supabase
      .rpc("get_appointment_by_token", { p_token: token })
      .then(({ data }) => setInfo((data as Info) ?? null));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (mode !== "reschedule" || !dateStr) return;
    setSlotsLoading(true);
    setSlot(null);
    supabase
      .rpc("get_reschedule_slots", { p_token: token, p_date: dateStr })
      .then(({ data }) => {
        setSlots((data as Slot[]) ?? []);
        setSlotsLoading(false);
      });
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
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("reschedule_appointment", {
      p_token: token,
      p_new_slot: slot.slot_start,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone("moved");
    load();
  }

  const dateText =
    info && info !== "loading"
      ? new Date(info.starts_at).toLocaleString("he-IL", {
          weekday: "long",
          day: "numeric",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

  return (
    <main className="mx-auto flex max-w-md flex-col items-center px-4 pb-16 pt-8 text-center">
      <Image src="/logo.png" alt="Pretty Easy" width={180} height={54} className="mb-6" />

      {info === "loading" && <p className="text-plum-500">טוען…</p>}

      {info === null && (
        <div className="card w-full">
          <p>התור לא נמצא. ייתכן שהקישור שגוי.</p>
        </div>
      )}

      {info && info !== "loading" && done === "cancelled" && (
        <div className="card w-full">
          <h1 className="mb-2 text-xl font-bold">התור בוטל</h1>
          <p className="text-plum-500">נשמח לראות אותך בפעם אחרת 💕</p>
          <a href="/" className="btn-primary mt-4 inline-block">
            קביעת תור חדש
          </a>
        </div>
      )}

      {info && info !== "loading" && info.status === "cancelled" && !done && (
        <div className="card w-full">
          <h1 className="mb-2 text-xl font-bold">התור הזה בוטל</h1>
          <a href="/" className="btn-primary mt-4 inline-block">
            קביעת תור חדש
          </a>
        </div>
      )}

      {info && info !== "loading" && info.status !== "cancelled" && done !== "cancelled" && (
        <>
          <div className="card w-full">
            <h1 className="mb-2 text-xl font-bold">
              {done === "moved" ? "התור עודכן! 🎉" : `היי ${info.client_name} 👋`}
            </h1>
            <p className="mb-1 text-sm text-plum-500">התור שלך:</p>
            <p className="font-semibold">{info.service_name}</p>
            <p className="mb-2 font-semibold">{dateText}</p>
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs ${
                info.status === "pending"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-green-100 text-green-800"
              }`}
            >
              {info.status === "pending" ? "⏳ ממתין לאישור" : "✓ התור מאושר"}
            </span>

            {info.can_modify && mode === "view" && (
              <div className="mt-4 flex flex-col gap-2">
                <button className="btn-primary" onClick={() => setMode("reschedule")}>
                  🗓 הזזת התור למועד אחר
                </button>
                <button
                  className="btn-ghost text-red-700"
                  onClick={cancel}
                  disabled={busy}
                >
                  {busy ? "מבטל…" : "ביטול התור"}
                </button>
              </div>
            )}

            {!info.can_modify && (
              <p className="mt-3 rounded-xl bg-blush-100 p-3 text-sm">
                נשארו פחות מ-24 שעות לתור, אז שינוי או ביטול אפשריים רק בטלפון 💕
              </p>
            )}
            {error && mode === "view" && (
              <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
            )}
          </div>

          {mode === "reschedule" && info.can_modify && (
            <div className="card mt-4 w-full text-right">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-bold">בחרי מועד חדש</h2>
                <button className="btn-ghost text-sm" onClick={() => setMode("view")}>
                  סגירה
                </button>
              </div>

              <div className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-2">
                {days.map((d) => (
                  <button
                    key={d.str}
                    onClick={() => setDateStr(d.str)}
                    className={`flex min-w-[64px] flex-col items-center rounded-2xl border px-3 py-2 transition ${
                      dateStr === d.str
                        ? "border-plum-700 bg-plum-700 text-white"
                        : "border-blush-200 bg-white"
                    }`}
                  >
                    <span className="text-xs">{dayLabel(d.date)}</span>
                    <span className="text-lg font-bold">{d.date.getDate()}</span>
                  </button>
                ))}
              </div>

              {dateStr &&
                (slotsLoading ? (
                  <p className="text-sm text-plum-500">בודק שעות…</p>
                ) : slots.length === 0 ? (
                  <p className="rounded-xl bg-blush-100 p-3 text-sm">
                    אין שעות פנויות ביום זה – נסי יום אחר
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {slots.map((sl) => (
                      <button
                        key={sl.slot_start}
                        onClick={() => setSlot(sl)}
                        className={`rounded-xl border py-2.5 text-sm font-medium transition ${
                          slot?.slot_start === sl.slot_start
                            ? "border-plum-700 bg-plum-700 text-white"
                            : "border-blush-200 bg-white"
                        }`}
                      >
                        {sl.label}
                      </button>
                    ))}
                  </div>
                ))}

              {error && (
                <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
              )}
              <button
                className="btn-primary mt-4 w-full"
                disabled={!slot || busy}
                onClick={move}
              >
                {busy ? "מעדכנת…" : "אישור המועד החדש"}
              </button>
            </div>
          )}

          <div className="mt-4 w-full">
            <button
              className="btn-ghost w-full border border-blush-200"
              disabled={pushMsg === "ההתראות הופעלו ✓"}
              onClick={async () => {
                const r = await subscribeClientPush(token);
                setPushMsg(pushResultMessage(r));
              }}
            >
              🔔 הפעלת תזכורת יום לפני התור
            </button>
            {pushMsg && <p className="mt-2 text-xs text-plum-500">{pushMsg}</p>}
          </div>
        </>
      )}
    </main>
  );
}
