"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase, Service, Slot, Addon, priceLabel, durationLabel, gcalLink } from "@/lib/supabase";
import { subscribeClientPush, pushResultMessage } from "@/lib/push";
import BottomNav from "./nav";
import {
  BellIcon, PlusIcon, ChevronLeft, ChevronRight, CheckIcon, SunIcon, NoonIcon, MoonIcon,
  ClockIcon, InfoIcon, BrandIcon, GiftIcon,
} from "@/lib/icons";

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

// שלבים: 0 בית · 1 טיפול · 2 תוספות · 3 מועד · 4 פרטים · 5 נשלח
const HOME = 0, SERVICE = 1, ADDONS = 2, TIME = 3, DETAILS = 4, DONE = 5;

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
function slotGroup(label: string) {
  const h = parseInt(label.slice(0, 2), 10);
  if (h < 12) return "בוקר";
  if (h < 16) return "צהריים";
  return "ערב";
}
const GROUP_ICON: Record<string, (p: { size?: number }) => JSX.Element> = {
  בוקר: SunIcon, צהריים: NoonIcon, ערב: MoonIcon,
};

function rememberClient(name: string, phone: string) {
  try { localStorage.setItem("pe_client", JSON.stringify({ name, phone })); } catch {}
}
function loadClient(): { name: string; phone: string } | null {
  try { const raw = localStorage.getItem("pe_client"); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function rememberToken(t: string) {
  try {
    const arr: string[] = JSON.parse(localStorage.getItem("pe_tokens") || "[]");
    arr.push(t);
    localStorage.setItem("pe_tokens", JSON.stringify(arr.slice(-20)));
    localStorage.setItem("pe_last_token", t);
  } catch {}
}

type MyAppt = {
  cancel_token: string; service_name: string; price: number; price_max?: number | null;
  addons?: { name: string; duration_minutes?: number }[]; starts_at: string; ends_at?: string;
  status: "pending" | "confirmed" | "cancelled"; is_past: boolean;
};

export default function BookingPage() {
  const [step, setStep] = useState(HOME);
  const [services, setServices] = useState<Service[] | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [chosen, setChosen] = useState<Addon[]>([]);
  const [availability, setAvailability] = useState<Record<string, number> | null>(null);
  const [dateStr, setDateStr] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [known, setKnown] = useState(false);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelToken, setCancelToken] = useState<string | null>(null);

  // בית מותאם אישית
  const [me, setMe] = useState<{ name: string; appts: MyAppt[] } | null>(null);

  // טווח קביעה קדימה
  const [horizonDays, setHorizonDays] = useState<number | null>(null);
  useEffect(() => {
    supabase.rpc("get_booking_horizon").then(({ data }) => {
      const d = (data as { days?: number } | null)?.days;
      setHorizonDays(typeof d === "number" ? Math.min(d, 120) : 21);
    });
  }, []);

  const days = useMemo(() => {
    const out: { date: Date; str: string }[] = [];
    for (let i = 0; i < (horizonDays ?? 21); i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      out.push({ date: d, str: toDateStr(d) });
    }
    return out;
  }, [horizonDays]);

  useEffect(() => {
    const c = loadClient();
    if (c?.name && c?.phone) { setName(c.name); setPhone(c.phone); setKnown(true); }
    try {
      const t = localStorage.getItem("pe_last_token");
      if (t) {
        supabase.rpc("get_my_appointments", { p_token: t }).then(({ data }) => {
          const d = data as { client_name: string; appointments: MyAppt[] } | null;
          if (d) setMe({ name: d.client_name, appts: d.appointments });
        });
      }
    } catch {}
    supabase.from("services").select("*").eq("is_active", true).order("price", { ascending: false })
      .then(({ data }) => {
        const list = (data as Service[]) ?? [];
        setServices(list);
        if (list.length === 1) setService(list[0]);
      });
    supabase.from("addons").select("*").eq("is_active", true).order("price")
      .then(({ data }) => setAddons((data as Addon[]) ?? []));
    // כניסה ישירה לקביעת תור מהניווט התחתון
    try {
      if (new URLSearchParams(window.location.search).get("book") === "1") setStep(-1);
    } catch {}
  }, []);

  const multiService = (services?.length ?? 0) > 1;
  const hasAddons = addons.length > 0;
  const chosenIds = chosen.map((a) => a.id);
  const addonIdsParam = chosenIds.length ? chosenIds : null;

  // step -1 = "התחילי הזמנה ברגע שהנתונים נטענו"
  useEffect(() => {
    if (step === -1 && services !== null) startBooking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, services, addons]);

  const total = useMemo(() => {
    if (!service) return null;
    const lo = Number(service.price) + chosen.reduce((s, a) => s + Number(a.price), 0);
    const hi = Number(service.price_max ?? service.price) + chosen.reduce((s, a) => s + Number(a.price_max ?? a.price), 0);
    return { lo, hi: hi > lo ? hi : null };
  }, [service, chosen]);
  const totalMinutes = service ? service.duration_minutes + chosen.reduce((s, a) => s + a.duration_minutes, 0) : 0;
  const serviceTitle = service ? service.name + (chosen.length ? " + " + chosen.map((a) => a.name).join(" + ") : "") : "";

  function startBooking() {
    if (services && services.length === 1) { setService(services[0]); setStep(hasAddons ? ADDONS : TIME); }
    else setStep(SERVICE);
  }
  function afterService(s: Service) { setService(s); setChosen([]); setStep(hasAddons ? ADDONS : TIME); }

  const [availKey, setAvailKey] = useState("");
  useEffect(() => {
    if (!service || step !== TIME || horizonDays === null) return;
    const key = service.id + "|" + chosenIds.join(",") + "|" + horizonDays;
    if (key === availKey) return;
    setAvailKey(key); setAvailability(null); setDateStr(""); setSlot(null);
    supabase.rpc("get_available_dates_v2", {
      p_service_id: service.id, p_from: toDateStr(new Date()), p_days: horizonDays ?? 21, p_addon_ids: addonIdsParam,
    }).then(({ data }) => {
      const map: Record<string, number> = {};
      (data as { day: string; free_count: number }[] | null)?.forEach((r) => (map[r.day] = Number(r.free_count)));
      setAvailability(map);
      const firstFree = days.find((d) => (map[d.str] ?? 0) > 0);
      if (firstFree) setDateStr(firstFree.str);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, step, horizonDays]);

  useEffect(() => {
    if (!service || !dateStr) return;
    setSlotsLoading(true); setSlot(null);
    supabase.rpc("get_available_slots_v2", { p_service_id: service.id, p_date: dateStr, p_addon_ids: addonIdsParam })
      .then(({ data }) => { setSlots((data as Slot[]) ?? []); setSlotsLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, dateStr]);

  async function book() {
    if (!service || !slot) return;
    setSubmitting(true); setError(null);
    const { data, error } = await supabase.rpc("book_appointment_v2", {
      p_service_id: service.id, p_slot_start: slot.slot_start, p_name: name, p_phone: phone, p_notes: notes, p_addon_ids: addonIdsParam,
    });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      if (error.message.includes("פנוי")) {
        const { data: fresh } = await supabase.rpc("get_available_slots_v2", { p_service_id: service.id, p_date: dateStr, p_addon_ids: addonIdsParam });
        setSlots((fresh as Slot[]) ?? []); setSlot(null); setStep(TIME);
      }
      return;
    }
    const token = (data as { cancel_token: string }).cancel_token;
    rememberToken(token); rememberClient(name.trim(), phone.trim());
    setKnown(true); setEditing(false); setCancelToken(token); setStep(DONE);
  }

  const selectedDay = days.find((d) => d.str === dateStr);
  const grouped = useMemo(() => {
    const g: Record<string, Slot[]> = {};
    slots.forEach((s) => { const k = slotGroup(s.label); (g[k] ??= []).push(s); });
    return g;
  }, [slots]);
  const stages = useMemo(() => {
    const s: number[] = [];
    if (multiService) s.push(SERVICE);
    if (hasAddons) s.push(ADDONS);
    s.push(TIME, DETAILS);
    return s;
  }, [multiService, hasAddons]);

  const visibleMonth = selectedDay ? selectedDay.date : days[0]?.date ?? new Date();

  /* ====================== בית ====================== */
  if (step === HOME || step === -1) {
    const upcoming = (me?.appts ?? [])
      .filter((a) => !a.is_past && a.status !== "cancelled")
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const next = upcoming[0];
    const past = (me?.appts ?? []).filter((a) => a.is_past && a.status !== "cancelled");
    const counts: Record<string, number> = {};
    past.forEach((a) => (counts[a.service_name] = (counts[a.service_name] ?? 0) + 1));
    const favorite = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const lastVisit = past[0] ? new Date(past[0].starts_at) : null;
    const weeksSince = lastVisit ? Math.max(0, Math.round((Date.now() - lastVisit.getTime()) / (7 * 864e5))) : null;
    const daysToNext = next ? Math.max(0, Math.ceil((new Date(next.starts_at).getTime() - Date.now()) / 864e5)) : null;
    const firstName = (me?.name ?? name).split(" ")[0];
    const base = services?.[0];

    return (
      <main className="relative mx-auto min-h-[100svh] max-w-md overflow-hidden pb-28">
        <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-blush-100 opacity-70" />

        <header className="relative flex items-center justify-between px-6 pt-14">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-blush-500 shadow-card">
              <BrandIcon size={24} />
            </div>
            <div>
              <div className="text-xs font-semibold text-muted">Ariel Nails</div>
              <div className="text-lg font-extrabold leading-tight">{firstName ? `היי ${firstName} 👋` : "ברוכה הבאה 👋"}</div>
            </div>
          </div>
          <Link href="/my" aria-label="האזור האישי" className="icon-btn relative text-plum-700">
            <BellIcon size={20} />
            {next?.status === "pending" && <span className="absolute left-2.5 top-2.5 h-2 w-2 rounded-full bg-blush-500" />}
          </Link>
        </header>

        <div className="relative mt-6 flex flex-col gap-4 px-6">
          {next ? (
            <div className="card-dark animate-fade-up flex flex-col gap-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tracking-wide opacity-80">התור הבא שלך</span>
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold">
                  {next.status === "confirmed" ? "מאושר ✓" : "ממתין לאישור"}
                </span>
              </div>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-2xl font-extrabold leading-tight">
                    יום {DAY_NAMES[new Date(next.starts_at).getDay()]}, {new Date(next.starts_at).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })}
                  </div>
                  <div className="mt-1 text-[15px] opacity-85">
                    בשעה {new Date(next.starts_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })} · {next.service_name}
                    {next.addons && next.addons.length > 0 && " + " + next.addons.map((x) => x.name).join(" + ")}
                  </div>
                </div>
                <div className="min-w-[64px] rounded-2xl bg-white/12 px-3 py-2.5 text-center">
                  <div className="text-2xl font-extrabold leading-none">{daysToNext}</div>
                  <div className="text-[11px] opacity-80">{daysToNext === 1 ? "יום" : "ימים"}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Link href={`/cancel/${next.cancel_token}`} className="flex-1 rounded-full bg-white py-2.5 text-center text-[13px] font-bold text-plum-700">שינוי מועד</Link>
                <a
                  href={gcalLink({
                    title: `תור ל${next.service_name} – Ariel Nails`,
                    start: next.starts_at,
                    end: next.ends_at ?? new Date(new Date(next.starts_at).getTime() + 60 * 60000),
                    details: `${next.service_name}${next.addons && next.addons.length ? " + " + next.addons.map((x) => x.name).join(" + ") : ""}\nשינוי וביטול עד 24 שעות לפני`,
                  })}
                  target="_blank"
                  rel="noopener"
                  className="flex-1 rounded-full bg-white/12 py-2.5 text-center text-[13px] font-semibold text-white"
                >
                  הוספה ליומן
                </a>
              </div>
            </div>
          ) : (
            <div className="card-dark animate-fade-up">
              <div className="text-xs font-semibold tracking-wide opacity-80">ברוכה הבאה 💕</div>
              <div className="mt-1 text-2xl font-extrabold leading-tight">קביעת תור אונליין</div>
              <div className="mt-1 text-[15px] opacity-85">מהר, פשוט, מכל מקום – ואת מקבלת עדכון ברגע שהתור מאושר</div>
            </div>
          )}

          <button onClick={startBooking} className="card flex items-center justify-between text-right transition active:scale-[0.99]">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blush-50 text-blush-500"><PlusIcon size={24} /></div>
              <div>
                <div className="text-[17px] font-extrabold">קבעי תור חדש</div>
                <div className="text-[13px] text-muted">
                  {base ? `${base.name} · ${priceLabel(base.price, base.price_max)} · ${durationLabel(base.duration_minutes)}` : "טוען…"}
                </div>
              </div>
            </div>
            <ChevronLeft size={20} className="text-blush-300" />
          </button>

          {past.length > 0 && (
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-2xl border border-line bg-white px-2 py-3.5 text-center">
                <div className="text-2xl font-extrabold text-plum-700">{past.length}</div>
                <div className="text-[11px] font-medium text-muted">ביקורים</div>
              </div>
              <div className="rounded-2xl border border-line bg-white px-2 py-3.5 text-center">
                <div className="text-2xl font-extrabold text-plum-700">{weeksSince}</div>
                <div className="text-[11px] font-medium text-muted">שבועות מהביקור</div>
              </div>
              <div className="rounded-2xl border border-line bg-white px-2 py-3.5 text-center">
                <div className="truncate text-sm font-extrabold leading-[1.7] text-plum-700">{favorite ?? "–"}</div>
                <div className="text-[11px] font-medium text-muted">הטיפול הקבוע</div>
              </div>
            </div>
          )}

          {addons.length > 0 && (
            <div className="card flex items-center gap-3.5 !py-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blush-100 text-plum-700"><GiftIcon size={22} /></div>
              <div className="flex-1">
                <div className="text-sm font-bold">תוספות לבחירה</div>
                <div className="text-xs text-muted">{addons.slice(0, 3).map((a) => a.name).join(" · ")}</div>
              </div>
            </div>
          )}

          <Link href="/admin" className="mt-2 self-center text-[10px] text-muted/50">כניסת מנהלת</Link>
        </div>
        <BottomNav active="home" />
      </main>
    );
  }

  /* ====================== זרימת ההזמנה ====================== */
  const back = () => {
    if (step === SERVICE) setStep(HOME);
    else if (step === ADDONS) setStep(multiService ? SERVICE : HOME);
    else if (step === TIME) setStep(hasAddons ? ADDONS : multiService ? SERVICE : HOME);
    else if (step === DETAILS) setStep(TIME);
  };

  return (
    <main className="mx-auto min-h-[100svh] max-w-md pb-8">
      {step < DONE && (
        <header className="flex items-center justify-between px-6 pt-14">
          <button onClick={back} aria-label="חזרה" className="icon-btn text-plum-700"><ChevronRight size={20} /></button>
          <div className="flex items-center gap-1.5">
            {stages.map((s) => (
              <span key={s} className={`h-2 rounded-full transition-all ${s === step ? "w-7 bg-plum-700" : s < step ? "w-2 bg-blush-500" : "w-2 bg-blush-200"}`} />
            ))}
          </div>
          <span className="w-11" />
        </header>
      )}

      {step === SERVICE && (
        <section className="px-6 pt-5">
          <h1 className="text-[26px] font-extrabold leading-tight">איזה טיפול בא לך?</h1>
          <p className="mt-1.5 text-sm text-muted">בחרי טיפול ונמשיך לבחירת מועד</p>
          <div className="mt-5 flex flex-col gap-3">
            {(services ?? []).map((s) => (
              <button key={s.id} onClick={() => afterService(s)} className="card flex min-h-[76px] items-center justify-between text-right transition active:scale-[0.99]">
                <div>
                  <div className="text-base font-extrabold">{s.name}</div>
                  <div className="text-[13px] text-muted">{durationLabel(s.duration_minutes)}</div>
                </div>
                <div className="text-lg font-extrabold text-plum-700">{priceLabel(s.price, s.price_max)}</div>
              </button>
            ))}
            {services === null && <p className="text-center text-muted">טוען טיפולים…</p>}
          </div>
        </section>
      )}

      {step === ADDONS && service && (
        <section className="px-6 pb-28 pt-5">
          <h1 className="text-[26px] font-extrabold leading-tight">רוצה להוסיף משהו?</h1>
          <p className="mt-1.5 text-sm text-muted">{service.name} · אפשר גם להמשיך בלי תוספות</p>

          <div className="mt-5 flex flex-col gap-3">
            <OptionCard on={chosen.length === 0} onClick={() => setChosen([])} title="בלי תוספות" sub={`רק ${service.name}`} price={priceLabel(service.price, service.price_max)} muted />
            {addons.map((a) => {
              const on = chosenIds.includes(a.id);
              return (
                <OptionCard key={a.id} on={on}
                  onClick={() => setChosen((c) => (on ? c.filter((x) => x.id !== a.id) : [...c, a]))}
                  title={a.name}
                  sub={a.duration_minutes > 0 ? `+${durationLabel(a.duration_minutes)}` : "בלי תוספת זמן"}
                  price={`+${priceLabel(a.price, a.price_max)}`} />
              );
            })}
            <div className="mt-1 flex items-center gap-2.5 rounded-2xl bg-blush-50 px-3.5 py-3 text-plum-500">
              <InfoIcon size={18} className="shrink-0 text-blush-500" />
              <span className="text-xs">המחיר הסופי נקבע לפי מורכבות העבודה – לכן מוצג טווח</span>
            </div>
          </div>

          <div className="sticky-bar">
            <div className="mx-auto flex max-w-md items-center justify-between gap-3">
              <div className="text-sm">
                <div className="font-extrabold">{total && priceLabel(total.lo, total.hi)} · {durationLabel(totalMinutes)}</div>
                <div className="text-xs text-muted">{chosen.length === 0 ? "בלי תוספות" : chosen.map((a) => a.name).join(" + ")}</div>
              </div>
              <button className="btn-primary whitespace-nowrap !px-5" onClick={() => setStep(TIME)}>
                {chosen.length === 0 ? "המשך בלי תוספות" : chosen.length === 1 ? "המשך עם תוספת" : `המשך עם ${chosen.length} תוספות`}
              </button>
            </div>
          </div>
        </section>
      )}

      {step === TIME && service && (
        <section className="pb-28 pt-5">
          <div className="px-6">
            <h1 className="text-[26px] font-extrabold leading-tight">מתי נוח לך?</h1>
            <p className="mt-1.5 text-sm text-muted">{serviceTitle} · {durationLabel(totalMinutes)} · {total && priceLabel(total.lo, total.hi)}</p>
          </div>

          {horizonDays === 0 ? (
            <div className="card mx-6 mt-6 text-center">
              <p className="font-bold">היומן עוד לא נפתח לתאריכים הבאים 💕</p>
              <p className="mt-1 text-sm text-muted">הפעילי התראות ותקבלי עדכון ברגע שייפתחו תורים חדשים</p>
            </div>
          ) : availability === null ? (
            <p className="mt-6 px-6 text-muted">בודק ימים פנויים…</p>
          ) : (
            <>
              <div className="mt-5 flex items-center justify-between px-6">
                <span className="text-sm font-bold">{MONTHS[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}</span>
                <span className="text-xs font-semibold text-muted">{days.filter((d) => (availability[d.str] ?? 0) > 0).length} ימים פנויים</span>
              </div>
              <div className="mt-3 flex gap-2 overflow-x-auto px-6 pb-2">
                {days.map((d) => {
                  const free = availability[d.str] ?? 0;
                  const disabled = free === 0;
                  const on = dateStr === d.str;
                  return (
                    <button key={d.str} disabled={disabled} onClick={() => setDateStr(d.str)}
                      className={`flex h-[76px] min-w-[60px] flex-col items-center justify-center gap-0.5 rounded-2xl border transition ${
                        on ? "border-plum-700 bg-plum-700 text-white shadow-plum"
                          : disabled ? "border-transparent bg-blush-50 text-blush-300"
                          : "border-line bg-white active:scale-95"}`}>
                      <span className={`text-[11px] font-semibold ${on ? "opacity-85" : disabled ? "" : "text-muted"}`}>{dayLabel(d.date)}</span>
                      <span className="text-xl font-extrabold leading-tight">{d.date.getDate()}</span>
                      <span className={`h-1.5 w-1.5 rounded-full ${disabled ? "bg-transparent" : on ? "bg-white" : "bg-blush-500"}`} />
                    </button>
                  );
                })}
              </div>

              {dateStr && (
                <div className="mt-5 flex flex-col gap-5 px-6">
                  {slotsLoading ? (
                    <p className="text-muted">בודק שעות…</p>
                  ) : slots.length === 0 ? (
                    <p className="rounded-2xl bg-blush-50 p-4 text-sm">אין שעות פנויות ביום זה – נסי יום אחר</p>
                  ) : (
                    Object.entries(grouped).map(([group, list]) => {
                      const Icon = GROUP_ICON[group] ?? ClockIcon;
                      return (
                        <div key={group}>
                          <div className="mb-2.5 flex items-center gap-2 text-muted">
                            <Icon size={16} />
                            <span className="text-[13px] font-bold">{group}</span>
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            {list.map((sl) => {
                              const on = slot?.slot_start === sl.slot_start;
                              return (
                                <button key={sl.slot_start} onClick={() => setSlot(sl)}
                                  className={`h-[46px] rounded-2xl border text-[15px] transition active:scale-95 ${
                                    on ? "border-plum-700 bg-plum-700 font-bold text-white shadow-plum" : "border-line bg-white font-semibold"}`}>
                                  {sl.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </>
          )}

          <div className="sticky-bar">
            <div className="mx-auto flex max-w-md items-center justify-between gap-3">
              <div className="text-sm">
                {slot && selectedDay ? (
                  <>
                    <div className="font-extrabold">{dayLabel(selectedDay.date)} {selectedDay.date.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })} · {slot.label}</div>
                    <div className="text-xs text-muted">{serviceTitle}</div>
                  </>
                ) : (
                  <span className="text-muted">בחרי שעה כדי להמשיך</span>
                )}
              </div>
              <button className="btn-primary min-w-[112px]" disabled={!slot} onClick={() => setStep(DETAILS)}>המשך</button>
            </div>
          </div>
        </section>
      )}

      {step === DETAILS && service && slot && selectedDay && (
        <section className="px-6 pt-5">
          <h1 className="text-[26px] font-extrabold leading-tight">כמעט סיימנו</h1>
          <p className="mt-1.5 text-sm text-muted">עוד רגע והבקשה אצל אריאל</p>

          <div className="card mt-5 flex items-center gap-3.5 !py-4">
            <div className="rounded-2xl bg-plum-700 px-3 py-2 text-center text-white">
              <div className="text-[11px] opacity-85">{DAY_NAMES[selectedDay.date.getDay()]}</div>
              <div className="text-xl font-extrabold leading-none">{selectedDay.date.getDate()}</div>
              <div className="text-[10px] opacity-85">{MONTHS[selectedDay.date.getMonth()].slice(0, 4)}'</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-extrabold">{serviceTitle}</div>
              <div className="text-[13px] text-muted">בשעה {slot.label} · {durationLabel(totalMinutes)} · {total && priceLabel(total.lo, total.hi)}</div>
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); book(); }} className="mt-4 flex flex-col gap-4">
            {known && !editing ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-blush-50 px-4 py-3.5">
                <div className="text-sm">
                  <div className="text-xs text-muted">קובעת בשם</div>
                  <div className="font-extrabold">{name}</div>
                  <div dir="ltr" className="text-right text-muted">{phone}</div>
                </div>
                <button type="button" className="btn-ghost text-xs" onClick={() => setEditing(true)}>לא את? עריכה</button>
              </div>
            ) : (
              <>
                <div>
                  <label className="label">שם מלא</label>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" placeholder="השם שלך" />
                </div>
                <div>
                  <label className="label">טלפון</label>
                  <input className="input" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required autoComplete="tel" placeholder="050-1234567" dir="ltr" style={{ textAlign: "right" }} />
                </div>
              </>
            )}
            <div>
              <label className="label">הערות (לא חובה)</label>
              <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="משהו שכדאי לדעת? גוון, רעיון, בקשה מיוחדת…" />
            </div>
            {error && <p className="rounded-2xl bg-danger-50 p-3 text-sm text-danger">{error}</p>}
            <button className="btn-primary" type="submit" disabled={submitting}>{submitting ? "שולחת…" : "שליחת בקשה לתור"}</button>
            <p className="text-center text-xs text-muted">התור ייכנס ליומן אחרי אישור – תקבלי עדכון</p>
          </form>
        </section>
      )}

      {step === DONE && service && slot && selectedDay && (
        <section className="relative -mt-8 flex min-h-[100svh] flex-col overflow-hidden bg-plum-700 px-7 pt-20 text-center text-white">
          <div className="pointer-events-none absolute -left-32 -top-36 h-[380px] w-[380px] rounded-full bg-plum-500 opacity-60" />
          <div className="pointer-events-none absolute -right-40 bottom-32 h-[360px] w-[360px] rounded-full bg-blush-500 opacity-20" />
          <div className="relative flex flex-1 flex-col items-center justify-center gap-5">
            <div className="animate-pop flex h-24 w-24 items-center justify-center rounded-[32px] bg-white/12 shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
              <ClockIcon size={46} />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold leading-tight">הבקשה נשלחה!</h1>
              <p className="mt-2 text-[15px] leading-relaxed opacity-85">אריאל תאשר את התור בקרוב –<br />ברגע שיאושר תקבלי עדכון</p>
            </div>
            <div className="w-full rounded-3xl bg-white p-5 text-right text-ink shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted">סיכום התור</span>
                <span className="badge-wait">ממתין לאישור</span>
              </div>
              <div className="mt-2.5 text-lg font-extrabold">יום {DAY_NAMES[selectedDay.date.getDay()]}, {selectedDay.date.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })} · {slot.label}</div>
              <div className="text-sm text-plum-500">{serviceTitle} · {durationLabel(totalMinutes)}</div>
              <div className="mt-2.5 flex justify-between border-t border-dashed border-line pt-2.5 text-sm">
                <span className="text-muted">מחיר משוער</span><span className="font-extrabold">{total && priceLabel(total.lo, total.hi)}</span>
              </div>
            </div>
            <NotifyButton token={cancelToken!} />
            <Link href="/my" className="text-sm font-semibold opacity-85">לאזור האישי שלי ›</Link>
          </div>
          <p className="relative pb-10 pt-6 text-xs opacity-60">שינוי וביטול עד 24 שעות לפני התור</p>
        </section>
      )}
    </main>
  );
}

function OptionCard({ on, onClick, title, sub, price, muted }: { on: boolean; onClick: () => void; title: string; sub: string; price: string; muted?: boolean }) {
  return (
    <button onClick={onClick}
      className={`flex items-center justify-between rounded-3xl border bg-white px-4.5 py-4 text-right transition active:scale-[0.99] ${
        on ? "border-2 border-plum-700 shadow-card" : "border-line"}`}
      style={{ paddingInline: 18 }}>
      <div className="flex items-center gap-3">
        <span className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full ${on ? "bg-plum-700 text-white" : "border-2 border-blush-200"}`}>
          {on && <CheckIcon size={14} strokeWidth={3} />}
        </span>
        <div>
          <div className="text-base font-bold">{title}</div>
          <div className="text-xs text-muted">{sub}</div>
        </div>
      </div>
      <div className={`text-[15px] font-extrabold ${muted && !on ? "text-muted" : "text-plum-700"}`}>{price}</div>
    </button>
  );
}

function NotifyButton({ token }: { token: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const done = msg === "ההתראות הופעלו ✓";
  return (
    <div className="w-full">
      <button className="btn-blush flex h-14 w-full items-center justify-center gap-2.5 text-base" disabled={busy || done}
        onClick={async () => { setBusy(true); const r = await subscribeClientPush(token); setMsg(pushResultMessage(r)); setBusy(false); }}>
        <BellIcon size={20} strokeWidth={2.2} />
        {done ? "ההתראות הופעלו ✓" : "עדכנו אותי כשהתור מאושר"}
      </button>
      {msg && !done && <p className="mt-2 text-center text-xs opacity-85">{msg}</p>}
    </div>
  );
}
