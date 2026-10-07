"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase, Service, Slot, Addon, priceLabel, durationLabel } from "@/lib/supabase";
import { subscribeClientPush, pushResultMessage } from "@/lib/push";

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

// שלבים: 0 בית · 1 טיפול · 2 תוספות · 3 מועד · 4 פרטים · 5 נשלח
const HOME = 0, SERVICE = 1, ADDONS = 2, TIME = 3, DETAILS = 4, DONE = 5;

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

function slotGroup(label: string) {
  const h = parseInt(label.slice(0, 2), 10);
  if (h < 12) return "בוקר ☀️";
  if (h < 16) return "צהריים 🌤";
  return "אחה״צ וערב 🌙";
}

function rememberToken(t: string) {
  try {
    const arr: string[] = JSON.parse(localStorage.getItem("pe_tokens") || "[]");
    arr.push(t);
    localStorage.setItem("pe_tokens", JSON.stringify(arr.slice(-20)));
    localStorage.setItem("pe_last_token", t);
  } catch {}
}

export default function BookingPage() {
  const [step, setStep] = useState(HOME);
  const [services, setServices] = useState<Service[] | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [chosen, setChosen] = useState<Addon[]>([]);
  const [availability, setAvailability] = useState<Record<string, number> | null>(null);
  const [dateStr, setDateStr] = useState<string>("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelToken, setCancelToken] = useState<string | null>(null);

  const days = useMemo(() => {
    const out: { date: Date; str: string }[] = [];
    for (let i = 0; i < 21; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      out.push({ date: d, str: toDateStr(d) });
    }
    return out;
  }, []);

  useEffect(() => {
    supabase
      .from("services")
      .select("*")
      .eq("is_active", true)
      .order("price", { ascending: false })
      .then(({ data }) => {
        const list = (data as Service[]) ?? [];
        setServices(list);
        if (list.length === 1) setService(list[0]);
      });
    supabase
      .from("addons")
      .select("*")
      .eq("is_active", true)
      .order("price")
      .then(({ data }) => setAddons((data as Addon[]) ?? []));
  }, []);

  const multiService = (services?.length ?? 0) > 1;
  const hasAddons = addons.length > 0;
  const chosenIds = chosen.map((a) => a.id);
  const addonIdsParam = chosenIds.length ? chosenIds : null;

  // מחיר כולל (טווח)
  const total = useMemo(() => {
    if (!service) return null;
    const lo = Number(service.price) + chosen.reduce((s, a) => s + Number(a.price), 0);
    const hi =
      Number(service.price_max ?? service.price) +
      chosen.reduce((s, a) => s + Number(a.price_max ?? a.price), 0);
    return { lo, hi: hi > lo ? hi : null };
  }, [service, chosen]);

  const totalMinutes = service
    ? service.duration_minutes + chosen.reduce((s, a) => s + a.duration_minutes, 0)
    : 0;

  function startBooking() {
    if (services && services.length === 1) {
      setService(services[0]);
      setStep(hasAddons ? ADDONS : TIME);
    } else {
      setStep(SERVICE);
    }
  }

  function afterService(s: Service) {
    setService(s);
    setChosen([]);
    setStep(hasAddons ? ADDONS : TIME);
  }

  // ימים פנויים – תלויי טיפול + תוספות.
  // נטען רק כשנכנסים לשלב המועד עם שילוב חדש – חזרה מהפרטים לא מאפסת את הבחירה.
  const [availKey, setAvailKey] = useState("");
  useEffect(() => {
    if (!service || step !== TIME) return;
    const key = service.id + "|" + chosenIds.join(",");
    if (key === availKey) return;
    setAvailKey(key);
    setAvailability(null);
    setDateStr("");
    setSlot(null);
    supabase
      .rpc("get_available_dates_v2", {
        p_service_id: service.id,
        p_from: toDateStr(new Date()),
        p_days: 21,
        p_addon_ids: addonIdsParam,
      })
      .then(({ data }) => {
        const map: Record<string, number> = {};
        (data as { day: string; free_count: number }[] | null)?.forEach(
          (r) => (map[r.day] = Number(r.free_count))
        );
        setAvailability(map);
        const firstFree = days.find((d) => (map[d.str] ?? 0) > 0);
        if (firstFree) setDateStr(firstFree.str);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, step]);

  useEffect(() => {
    if (!service || !dateStr) return;
    setSlotsLoading(true);
    setSlot(null);
    supabase
      .rpc("get_available_slots_v2", {
        p_service_id: service.id,
        p_date: dateStr,
        p_addon_ids: addonIdsParam,
      })
      .then(({ data }) => {
        setSlots((data as Slot[]) ?? []);
        setSlotsLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, dateStr]);

  async function book() {
    if (!service || !slot) return;
    setSubmitting(true);
    setError(null);
    const { data, error } = await supabase.rpc("book_appointment_v2", {
      p_service_id: service.id,
      p_slot_start: slot.slot_start,
      p_name: name,
      p_phone: phone,
      p_notes: notes,
      p_addon_ids: addonIdsParam,
    });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      if (error.message.includes("פנוי")) {
        const { data: fresh } = await supabase.rpc("get_available_slots_v2", {
          p_service_id: service.id,
          p_date: dateStr,
          p_addon_ids: addonIdsParam,
        });
        setSlots((fresh as Slot[]) ?? []);
        setSlot(null);
        setStep(TIME);
      }
      return;
    }
    const token = (data as { cancel_token: string }).cancel_token;
    rememberToken(token);
    setCancelToken(token);
    setStep(DONE);
  }

  const selectedDay = days.find((d) => d.str === dateStr);
  const grouped = useMemo(() => {
    const g: Record<string, Slot[]> = {};
    slots.forEach((s) => {
      const k = slotGroup(s.label);
      (g[k] ??= []).push(s);
    });
    return g;
  }, [slots]);

  // נקודות התקדמות – רק שלבים שקיימים בזרימה
  const stages = useMemo(() => {
    const s: number[] = [];
    if (multiService) s.push(SERVICE);
    if (hasAddons) s.push(ADDONS);
    s.push(TIME, DETAILS);
    return s;
  }, [multiService, hasAddons]);

  /* ===== מסך בית ===== */
  if (step === HOME) {
    return (
      <main className="mx-auto flex min-h-[100svh] max-w-md flex-col items-center justify-between px-6 pb-10 pt-16 text-center">
        <div className="flex flex-1 flex-col items-center justify-center gap-6">
          <Image src="/logo.png" alt="Pretty Easy" width={280} height={84} priority />
          <p className="text-lg leading-relaxed text-plum-500">
            ברוכה הבאה 💕
            <br />
            קביעת תור אונליין – מהר, פשוט, מכל מקום
          </p>
          <button
            onClick={startBooking}
            className="btn-primary w-full max-w-xs py-4 text-lg shadow-lg shadow-blush-200"
          >
            קבעי תור ✨
          </button>
          <Link href="/my" className="btn-ghost border border-blush-200">
            👤 האזור האישי שלי
          </Link>
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-xs text-plum-500/60">שינוי וביטול תור – עד 24 שעות לפני</p>
          <Link href="/admin" className="text-[10px] text-plum-500/40">
            כניסת מנהלת
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 pb-8">
      <header className="flex flex-col items-center pt-6 pb-4">
        <button onClick={() => setStep(HOME)}>
          <Image src="/logo.png" alt="Pretty Easy" width={190} height={57} priority />
        </button>
      </header>

      {step < DONE && (
        <div className="mb-5 flex items-center justify-center gap-2">
          {stages.map((s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all ${
                s === step ? "w-8 bg-plum-700" : s < step ? "w-2 bg-blush-400" : "w-2 bg-blush-200"
              }`}
            />
          ))}
        </div>
      )}

      {step === SERVICE && (
        <section>
          <button className="btn-ghost mb-1 text-sm" onClick={() => setStep(HOME)}>
            → חזרה
          </button>
          <h1 className="mb-4 text-xl font-bold">איזה טיפול בא לך? 💅</h1>
          <div className="flex flex-col gap-3">
            {(services ?? []).map((s) => (
              <button
                key={s.id}
                onClick={() => afterService(s)}
                className="card flex min-h-[72px] items-center justify-between text-right transition active:scale-[0.99] hover:ring-2 hover:ring-blush-300"
              >
                <div>
                  <div className="text-base font-semibold">{s.name}</div>
                  <div className="text-sm text-plum-500">{durationLabel(s.duration_minutes)}</div>
                </div>
                <div className="text-lg font-bold text-blush-600">
                  {priceLabel(s.price, s.price_max)}
                </div>
              </button>
            ))}
            {services === null && <p className="text-center text-plum-500">טוען טיפולים…</p>}
          </div>
        </section>
      )}

      {step === ADDONS && service && (
        <section className="pb-24">
          <button
            className="btn-ghost mb-1 text-sm"
            onClick={() => setStep(multiService ? SERVICE : HOME)}
          >
            → חזרה
          </button>
          <h1 className="mb-1 text-xl font-bold">רוצה להוסיף משהו? ✨</h1>
          <p className="mb-4 text-sm text-plum-500">
            {service.name} · אפשר גם להמשיך בלי תוספות
          </p>

          <div className="flex flex-col gap-3">
            {addons.map((a) => {
              const on = chosenIds.includes(a.id);
              return (
                <button
                  key={a.id}
                  onClick={() =>
                    setChosen((c) => (on ? c.filter((x) => x.id !== a.id) : [...c, a]))
                  }
                  className={`card flex items-center justify-between text-right transition active:scale-[0.99] ${
                    on ? "ring-2 ring-plum-700" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-sm ${
                        on
                          ? "border-plum-700 bg-plum-700 text-white"
                          : "border-blush-300 text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                    <div>
                      <div className="font-semibold">{a.name}</div>
                      {a.duration_minutes > 0 && (
                        <div className="text-xs text-plum-500">+{durationLabel(a.duration_minutes)}</div>
                      )}
                    </div>
                  </div>
                  <div className="font-bold text-blush-600">
                    +{priceLabel(a.price, a.price_max)}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="fixed inset-x-0 bottom-0 border-t border-blush-100 bg-white/90 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
            <div className="mx-auto flex max-w-md items-center gap-3">
              <div className="flex-1 text-sm">
                <div className="font-semibold">
                  {total && priceLabel(total.lo, total.hi)} · {durationLabel(totalMinutes)}
                </div>
                <div className="text-plum-500">
                  {chosen.length === 0
                    ? "בלי תוספות"
                    : chosen.map((a) => a.name).join(" + ")}
                </div>
              </div>
              <button className="btn-primary min-w-[112px]" onClick={() => setStep(TIME)}>
                המשך
              </button>
            </div>
          </div>
        </section>
      )}

      {step === TIME && service && (
        <section className="pb-24">
          <button
            className="btn-ghost mb-1 text-sm"
            onClick={() => setStep(hasAddons ? ADDONS : multiService ? SERVICE : HOME)}
          >
            → חזרה
          </button>
          <h1 className="mb-1 text-xl font-bold">מתי נוח לך?</h1>
          <p className="mb-4 text-sm text-plum-500">
            {service.name}
            {chosen.length > 0 && <> + {chosen.map((a) => a.name).join(" + ")}</>} ·{" "}
            {durationLabel(totalMinutes)} · {total && priceLabel(total.lo, total.hi)}
          </p>

          {availability === null ? (
            <p className="text-plum-500">בודק ימים פנויים…</p>
          ) : (
            <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-2">
              {days.map((d) => {
                const free = availability[d.str] ?? 0;
                const disabled = free === 0;
                return (
                  <button
                    key={d.str}
                    disabled={disabled}
                    onClick={() => setDateStr(d.str)}
                    className={`flex min-w-[72px] flex-col items-center rounded-2xl border px-3 py-2.5 transition ${
                      dateStr === d.str
                        ? "border-plum-700 bg-plum-700 text-white shadow-md"
                        : disabled
                        ? "border-transparent bg-blush-50 text-plum-500/30"
                        : "border-blush-200 bg-white active:scale-95"
                    }`}
                  >
                    <span className="text-xs font-medium">{dayLabel(d.date)}</span>
                    <span className="text-xl font-bold leading-tight">{d.date.getDate()}</span>
                    <span className="text-[11px]">
                      {d.date.toLocaleDateString("he-IL", { month: "short" })}
                    </span>
                    {!disabled && dateStr !== d.str && (
                      <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-blush-400" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {dateStr && (
            <>
              {slotsLoading ? (
                <p className="text-plum-500">בודק שעות…</p>
              ) : slots.length === 0 ? (
                <p className="rounded-xl bg-blush-100 p-4 text-sm">
                  אין שעות פנויות ביום זה 😕 נסי יום אחר
                </p>
              ) : (
                Object.entries(grouped).map(([group, groupSlots]) => (
                  <div key={group} className="mb-4">
                    <h3 className="mb-2 text-sm font-semibold text-plum-500">{group}</h3>
                    <div className="grid grid-cols-4 gap-2">
                      {groupSlots.map((sl) => (
                        <button
                          key={sl.slot_start}
                          onClick={() => setSlot(sl)}
                          className={`rounded-xl border py-3 text-center text-base font-medium transition active:scale-95 ${
                            slot?.slot_start === sl.slot_start
                              ? "border-plum-700 bg-plum-700 text-white shadow-md"
                              : "border-blush-200 bg-white"
                          }`}
                        >
                          {sl.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          <div className="fixed inset-x-0 bottom-0 border-t border-blush-100 bg-white/90 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
            <div className="mx-auto flex max-w-md items-center gap-3">
              <div className="flex-1 text-sm">
                {slot && selectedDay ? (
                  <>
                    <div className="font-semibold">
                      {dayLabel(selectedDay.date)} · {slot.label}
                    </div>
                    <div className="text-plum-500">{service.name}</div>
                  </>
                ) : (
                  <span className="text-plum-500">בחרי שעה כדי להמשיך</span>
                )}
              </div>
              <button
                className="btn-primary min-w-[112px]"
                disabled={!slot}
                onClick={() => setStep(DETAILS)}
              >
                המשך
              </button>
            </div>
          </div>
        </section>
      )}

      {step === DETAILS && service && slot && selectedDay && (
        <section>
          <button className="btn-ghost mb-1 text-sm" onClick={() => setStep(TIME)}>
            → חזרה לבחירת מועד
          </button>
          <h1 className="mb-4 text-xl font-bold">כמעט סיימנו ✨</h1>

          <div className="card mb-5 text-sm">
            <div className="font-semibold">
              {service.name}
              {chosen.length > 0 && <> + {chosen.map((a) => a.name).join(" + ")}</>}
            </div>
            <div className="text-plum-500">
              יום {DAY_NAMES[selectedDay.date.getDay()]},{" "}
              {selectedDay.date.toLocaleDateString("he-IL")} בשעה {slot.label} ·{" "}
              {total && priceLabel(total.lo, total.hi)}
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              book();
            }}
            className="flex flex-col gap-4"
          >
            <div>
              <label className="label">שם מלא</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                placeholder="השם שלך"
              />
            </div>
            <div>
              <label className="label">טלפון</label>
              <input
                className="input"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoComplete="tel"
                placeholder="050-1234567"
                dir="ltr"
                style={{ textAlign: "right" }}
              />
            </div>
            <div>
              <label className="label">הערות (לא חובה)</label>
              <textarea
                className="input"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="משהו שכדאי לדעת?"
              />
            </div>
            {error && (
              <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
            )}
            <button className="btn-primary" type="submit" disabled={submitting}>
              {submitting ? "שולחת…" : "שליחת בקשה לתור"}
            </button>
            <p className="text-center text-xs text-plum-500">
              התור ייכנס ליומן אחרי אישור – תקבלי עדכון ⏳
            </p>
          </form>
        </section>
      )}

      {step === DONE && service && slot && selectedDay && (
        <section className="flex flex-col items-center pt-6 text-center">
          <div className="animate-pop mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-blush-400 text-4xl text-white">
            ⏳
          </div>
          <h1 className="mb-2 text-2xl font-bold">הבקשה נשלחה!</h1>
          <p className="mb-1 font-medium">
            {service.name}
            {chosen.length > 0 && <> + {chosen.map((a) => a.name).join(" + ")}</>}
          </p>
          <p className="mb-1 font-medium">
            יום {DAY_NAMES[selectedDay.date.getDay()]}{" "}
            {selectedDay.date.toLocaleDateString("he-IL")} בשעה {slot.label}
          </p>
          <p className="mb-5 text-sm text-plum-500">
            התור ממתין לאישור – ברגע שיאושר תקבלי עדכון 💕
          </p>

          <NotifyButton token={cancelToken!} label="🔔 עדכנו אותי כשהתור מאושר" />

          <div className="card mt-4 w-full text-sm">
            <Link href="/my" className="font-medium text-blush-600 underline">
              👤 לאזור האישי שלי – מעקב, שינוי וביטול
            </Link>
            <p className="mt-2 text-xs text-plum-500">
              שינוי וביטול עד 24 שעות לפני התור
            </p>
          </div>
        </section>
      )}
    </main>
  );
}

function NotifyButton({ token, label }: { token: string; label: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="w-full">
      <button
        className="btn-primary w-full"
        disabled={busy || msg === "ההתראות הופעלו ✓"}
        onClick={async () => {
          setBusy(true);
          const r = await subscribeClientPush(token);
          setMsg(pushResultMessage(r));
          setBusy(false);
        }}
      >
        {label}
      </button>
      {msg && <p className="mt-2 text-center text-xs text-plum-500">{msg}</p>}
    </div>
  );
}
