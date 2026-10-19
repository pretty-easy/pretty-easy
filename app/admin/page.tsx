"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import type { Session } from "@supabase/supabase-js";
import {
  supabase,
  Service,
  Appointment,
  WorkingHour,
  WeeklyBreak,
  BlockedTime,
  Client,
  Addon,
  priceLabel,
  durationLabel,
  waLink,
  gcalLink,
} from "@/lib/supabase";
import { subscribeAdminPush, pushResultMessage } from "@/lib/push";
import {
  BellIcon, CalendarIcon, UsersIcon, MessageIcon, SettingsIcon, LogoutIcon, CheckIcon, XIcon,
  PhoneIcon, WhatsAppIcon, RefreshIcon, BrandIcon, ChevronLeft, ChevronRight, PlusIcon, SparkleIcon, ClockIcon,
} from "@/lib/icons";

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const TABS = ["יומן", "טיפולים", "תוספות", "שעות עבודה", "חסימות", "לקוחות", "הודעות"] as const;
type Tab = (typeof TABS)[number];
const SETTINGS_TABS: Tab[] = ["טיפולים", "תוספות", "שעות עבודה", "חסימות"];
type NavKey = "סקירה" | "יומן" | "לקוחות" | "הודעות" | "הגדרות";

function startOfWeek(d: Date) {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - out.getDay()); // ראשון
  return out;
}

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) return <p className="p-8 text-center text-plum-500">טוען…</p>;
  return session ? <Dashboard /> : <Login />;
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError("פרטי התחברות שגויים");
  }

  return (
    <main className="mx-auto flex min-h-[100svh] max-w-sm flex-col items-center justify-center px-6">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-[22px] bg-plum-900 text-blush-400 shadow-plum">
        <BrandIcon size={32} />
      </div>
      <form onSubmit={signIn} className="card flex w-full flex-col gap-4 shadow-card">
        <div className="text-center">
          <h1 className="text-xl font-extrabold">כניסת מנהלת</h1>
          <p className="mt-1 text-sm text-muted">Pretty Easy · ניהול תורים</p>
        </div>
        <input className="input" type="email" placeholder="אימייל" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr" />
        <input className="input" type="password" placeholder="סיסמה" value={password} onChange={(e) => setPassword(e.target.value)} required dir="ltr" />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button className="btn-primary" disabled={busy}>{busy ? "מתחברת…" : "כניסה"}</button>
      </form>
    </main>
  );
}

function Dashboard() {
  const [nav, setNav] = useState<NavKey>("סקירה");
  const [settingsTab, setSettingsTab] = useState<Tab>("טיפולים");
  const [pushMsg, setPushMsg] = useState<string | null>(null);

  const navItems: { key: NavKey; label: string; Icon: (p: { size?: number; strokeWidth?: number }) => JSX.Element }[] = [
    { key: "סקירה", label: "סקירה", Icon: SparkleIcon },
    { key: "יומן", label: "יומן", Icon: CalendarIcon },
    { key: "לקוחות", label: "לקוחות", Icon: UsersIcon },
    { key: "הודעות", label: "הודעות", Icon: MessageIcon },
    { key: "הגדרות", label: "הגדרות", Icon: SettingsIcon },
  ];

  return (
    <main className="mx-auto min-h-[100svh] max-w-2xl bg-[#F4EFF2] pb-28">
      <header className={`bg-plum-900 px-5 pt-12 text-white ${nav === "יומן" ? "pb-2" : "rounded-b-[28px] pb-5 shadow-plum"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-blush-400"><BrandIcon size={20} /></span>
            <div>
              <div className="text-[11px] font-medium opacity-70">Pretty Easy</div>
              <div className="text-base font-extrabold leading-tight">{nav}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              aria-label="הפעלת התראות על תורים חדשים"
              title="קבלת התראה על כל תור חדש"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10"
              onClick={async () => { const r = await subscribeAdminPush(); setPushMsg(pushResultMessage(r)); }}
            >
              <BellIcon size={18} />
            </button>
            <button aria-label="יציאה" className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10" onClick={() => supabase.auth.signOut()}>
              <LogoutIcon size={18} />
            </button>
          </div>
        </div>
        {pushMsg && <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-center text-xs">{pushMsg}</p>}
      </header>

      <div className={nav === "יומן" ? "" : "px-4 pt-4"}>
        {nav === "סקירה" && <OverviewTab goCalendar={() => setNav("יומן")} />}
        {nav === "יומן" && <CalendarTab />}
        {nav === "לקוחות" && <ClientsTab />}
        {nav === "הודעות" && <BroadcastTab />}
        {nav === "הגדרות" && (
          <>
            <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {SETTINGS_TABS.map((t) => (
                <button key={t} onClick={() => setSettingsTab(t)} className={`chip whitespace-nowrap ${settingsTab === t ? "chip-active" : ""}`}>{t}</button>
              ))}
            </div>
            {settingsTab === "טיפולים" && <ServicesTab />}
            {settingsTab === "תוספות" && <AddonsTab />}
            {settingsTab === "שעות עבודה" && <HoursTab />}
            {settingsTab === "חסימות" && <BlockedTab />}
          </>
        )}
      </div>

      <nav className="bottom-nav mx-auto max-w-2xl">
        {navItems.map(({ key, label, Icon }) => {
          const on = nav === key;
          return (
            <button key={key} onClick={() => setNav(key)} aria-label={label}
              className={`flex min-w-[56px] flex-col items-center gap-1 text-[11px] ${on ? "font-bold text-plum-900" : "font-semibold text-muted"}`}>
              <span className={`flex h-8 w-11 items-center justify-center rounded-full transition ${on ? "bg-blush-100" : ""}`}>
                <Icon size={20} strokeWidth={on ? 2.2 : 2} />
              </span>
              {label}
            </button>
          );
        })}
      </nav>
    </main>
  );
}

/* ===== יומן (בסגנון Google Calendar) ===== */

const HOUR_PX = 56;

function hourOf(iso: string) {
  const d = new Date(iso);
  return d.getHours() + d.getMinutes() / 60;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

function apptCalendarLink(a: Appointment) {
  const svc = a.services?.name ?? "";
  const extras = (a.addons ?? []).map((x) => x.name);
  const title = `${a.client_name} – ${svc}${extras.length ? " + " + extras.join(" + ") : ""}`;
  const details = [
    `לקוחה: ${a.client_name}`,
    `טלפון: ${a.client_phone}`,
    `טיפול: ${svc}${extras.length ? " + " + extras.join(" + ") : ""}`,
    a.notes ? `הערות: ${a.notes}` : "",
    "",
    "נוצר מ-Pretty Easy",
  ].filter(Boolean).join("\n");
  return gcalLink({ title, start: a.starts_at, end: a.ends_at, details });
}

// "HH:MM" בקפיצות של חצי שעה
function timeOptions(from = 6, to = 23) {
  const out: string[] = [];
  for (let h = from; h <= to; h++) {
    out.push(`${String(h).padStart(2, "0")}:00`);
    if (h < to) out.push(`${String(h).padStart(2, "0")}:30`);
  }
  return out;
}

function TimeSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      className="input !w-auto !py-2"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {timeOptions().map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}

function localDateTime(dateStr: string, time: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addMinutes(time: string, mins: number) {
  const [h, m] = time.split(":").map(Number);
  const total = Math.min(23 * 60, h * 60 + m + mins);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function CalendarTab() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [view, setView] = useState<"day" | "week">("day");
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [blocks, setBlocks] = useState<BlockedTime[]>([]);
  const [wbreaks, setWbreaks] = useState<WeeklyBreak[]>([]);
  const [pending, setPending] = useState<Appointment[]>([]);
  const [grid, setGrid] = useState({ start: 8, end: 20 });
  const [sel, setSel] = useState<Appointment | null>(null);
  const [busy, setBusy] = useState(false);
  // הזזת תור ע"י האדמין
  const [resOpen, setResOpen] = useState(false);
  const [resDate, setResDate] = useState("");
  const [resSlots, setResSlots] = useState<{ slot_start: string; label: string }[]>([]);
  const [resSlot, setResSlot] = useState<string | null>(null);
  const [resLoading, setResLoading] = useState(false);
  const [resError, setResError] = useState<string | null>(null);
  // אחרי אישור: הצעה להוסיף ליומן גוגל
  const [justApproved, setJustApproved] = useState<Appointment | null>(null);
  // חסימה מהירה מהיומן
  const [blockDraft, setBlockDraft] = useState<{
    date: string;
    start: string;
    end: string;
    reason: string;
  } | null>(null);

  async function saveBlock() {
    if (!blockDraft || blockDraft.start >= blockDraft.end) return;
    setBusy(true);
    await supabase.from("blocked_times").insert({
      starts_at: localDateTime(blockDraft.date, blockDraft.start).toISOString(),
      ends_at: localDateTime(blockDraft.date, blockDraft.end).toISOString(),
      reason: blockDraft.reason || null,
    });
    setBusy(false);
    setBlockDraft(null);
    load();
  }

  async function removeBlock(b: BlockedTime) {
    if (!confirm(`להסיר את החסימה${b.reason ? ` "${b.reason}"` : ""}?`)) return;
    await supabase.from("blocked_times").delete().eq("id", b.id);
    load();
  }

  const load = useCallback(async () => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 7);
    const [a, b, p] = await Promise.all([
      supabase
        .from("appointments")
        .select("*, services(name)")
        .gte("starts_at", weekStart.toISOString())
        .lt("starts_at", end.toISOString())
        .neq("status", "cancelled")
        .order("starts_at"),
      supabase
        .from("blocked_times")
        .select("*")
        .lt("starts_at", end.toISOString())
        .gt("ends_at", weekStart.toISOString()),
      supabase
        .from("appointments")
        .select("*, services(name)")
        .eq("status", "pending")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at"),
    ]);
    setAppts((a.data as Appointment[]) ?? []);
    setBlocks((b.data as BlockedTime[]) ?? []);
    setPending((p.data as Appointment[]) ?? []);
  }, [weekStart]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    supabase.from("services").select("*").then(({ data }) => setServices((data as Service[]) ?? []));
    supabase
      .from("weekly_breaks")
      .select("*")
      .then(({ data }) => setWbreaks((data as WeeklyBreak[]) ?? []));
    supabase.from("working_hours").select("*").then(({ data }) => {
      const whs = (data as WorkingHour[]) ?? [];
      if (whs.length) {
        const start = Math.min(...whs.map((w) => parseInt(w.start_time, 10)));
        const end = Math.max(
          ...whs.map((w) => parseInt(w.end_time, 10) + (w.end_time.slice(3, 5) !== "00" ? 1 : 0))
        );
        setGrid({ start: Math.max(0, start - 1), end: Math.min(23, end + 1) });
      }
    });
  }, []);

  async function setStatus(id: string, status: "confirmed" | "cancelled") {
    if (status === "cancelled" && !confirm("לבטל את התור? הלקוחה תקבל עדכון")) return;
    setBusy(true);
    await supabase.from("appointments").update({ status }).eq("id", id);
    setBusy(false);
    if (status === "confirmed") {
      const a = sel?.id === id ? sel : appts.find((x) => x.id === id) ?? pending.find((x) => x.id === id) ?? null;
      setJustApproved(a ? { ...a, status: "confirmed" } : null);
    }
    closeModal();
    load();
  }

  function closeModal() {
    setSel(null);
    setResOpen(false);
    setResDate("");
    setResSlot(null);
    setResError(null);
  }

  useEffect(() => {
    if (!resOpen || !resDate || !sel) return;
    setResLoading(true);
    setResSlot(null);
    supabase
      .rpc("admin_reschedule_slots", { p_id: sel.id, p_date: resDate })
      .then(({ data }) => {
        setResSlots((data as { slot_start: string; label: string }[]) ?? []);
        setResLoading(false);
      });
  }, [resOpen, resDate, sel]);

  async function adminMove() {
    if (!sel || !resSlot) return;
    setBusy(true);
    setResError(null);
    const { error } = await supabase.rpc("admin_reschedule_appointment", {
      p_id: sel.id,
      p_new_slot: resSlot,
    });
    setBusy(false);
    if (error) {
      setResError(error.message);
      return;
    }
    closeModal();
    load();
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const visDays = view === "day" ? [selectedDay] : days;
  const gridHours = Array.from({ length: grid.end - grid.start }, (_, i) => grid.start + i);
  const now = new Date();

  function moveWeek(dir: number) {
    const w = new Date(weekStart.getTime() + dir * 7 * 864e5);
    setWeekStart(w);
    const d = new Date(selectedDay.getTime() + dir * 7 * 864e5);
    setSelectedDay(d);
  }

  return (
    <section>
      {/* כותרת כהה: ניווט שבועי + פס ימים + סיכום */}
      <div className="rounded-b-[28px] bg-plum-900 px-5 pb-4 pt-3 text-white shadow-plum">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button aria-label="שבוע קודם" className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10" onClick={() => moveWeek(-1)}><ChevronRight size={18} /></button>
            <button aria-label="שבוע הבא" className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10" onClick={() => moveWeek(1)}><ChevronLeft size={18} /></button>
            <button className="mr-1 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold" onClick={() => { const t = new Date(); t.setHours(0, 0, 0, 0); setSelectedDay(t); setWeekStart(startOfWeek(t)); }}>היום</button>
          </div>
          <div>
            <div className="text-[11px] opacity-70">{view === "day" ? `יום ${DAY_NAMES[selectedDay.getDay()]}` : "שבוע"}</div>
            <div className="text-lg font-extrabold leading-tight">
              {view === "day"
                ? selectedDay.toLocaleDateString("he-IL", { day: "numeric", month: "long" })
                : `${days[0].toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })} – ${days[6].toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })}`}
            </div>
          </div>
          <div className="flex rounded-xl bg-white/10 p-[3px] text-xs font-bold">
            <button className={`rounded-[9px] px-3 py-1.5 ${view === "day" ? "bg-white text-plum-900" : "opacity-85"}`} onClick={() => setView("day")}>יום</button>
            <button className={`rounded-[9px] px-3 py-1.5 ${view === "week" ? "bg-white text-plum-900" : "opacity-85"}`} onClick={() => setView("week")}>שבוע</button>
          </div>
        </div>

        {view === "day" && (
          <div className="mt-4 grid grid-cols-7 gap-1">
            {days.map((d) => {
              const isSel = d.toDateString() === selectedDay.toDateString();
              const isToday = d.toDateString() === now.toDateString();
              const count = appts.filter((a) => new Date(a.starts_at).toDateString() === d.toDateString()).length;
              return (
                <button key={d.toISOString()} onClick={() => setSelectedDay(new Date(d))}
                  className={`flex flex-col items-center rounded-xl py-1.5 transition ${isSel ? "bg-white text-plum-900" : isToday ? "bg-white/15" : "opacity-75"}`}>
                  <span className="text-[10px]">{DAY_NAMES[d.getDay()].slice(0, 3)}'</span>
                  <span className="text-[15px] font-extrabold leading-tight">{d.getDate()}</span>
                  <span className={`h-1 w-1 rounded-full ${count > 0 ? (isSel ? "bg-plum-900" : "bg-blush-400") : "bg-transparent"}`} />
                </button>
              );
            })}
          </div>
        )}

        {(() => {
          const dayList = view === "day"
            ? appts.filter((a) => new Date(a.starts_at).toDateString() === selectedDay.toDateString())
            : appts;
          const expected = dayList.reduce((sum, a) => {
            const svc = services.find((x) => x.id === a.service_id);
            const base = Number(svc?.price ?? 0);
            const extra = (a.addons ?? []).reduce((t, x) => t + Number(x.price), 0);
            return sum + base + extra;
          }, 0);
          return (
            <div className="mt-3.5 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white/10 px-2.5 py-1 font-semibold">{dayList.length} תורים</span>
              {expected > 0 && <span className="rounded-full bg-white/10 px-2.5 py-1 font-semibold">₪{expected.toLocaleString()} צפוי</span>}
              {pending.length > 0 && <span className="rounded-full bg-[#F2B544] px-2.5 py-1 font-extrabold text-plum-900">{pending.length} ממתינים</span>}
            </div>
          );
        })()}
      </div>

      {/* ממתינים לאישור */}
      {pending.length > 0 && (
        <div className="mx-4 mt-4 rounded-3xl border border-[#F3DFAF] bg-[#FFF8E8] p-4">
          <h3 className="mb-2.5 text-sm font-extrabold text-[#8A5A12]">
            {pending.length} {pending.length === 1 ? "תור ממתין" : "תורים ממתינים"} לאישור
          </h3>
          <div className="flex flex-col gap-2">
            {pending.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 rounded-2xl bg-white p-3 text-sm">
                <button className="min-w-0 text-right" onClick={() => setSel(a)}>
                  <div className="truncate font-extrabold">
                    {a.client_name} · {a.services?.name}
                    {a.addons && a.addons.length > 0 && <span className="font-normal text-muted"> + {a.addons.map((x) => x.name).join(" + ")}</span>}
                  </div>
                  <div className="text-xs text-muted">
                    יום {DAY_NAMES[new Date(a.starts_at).getDay()]} {new Date(a.starts_at).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })} · {fmtTime(a.starts_at)}
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  <button className="flex items-center gap-1 rounded-full bg-success px-3 py-1.5 text-xs font-extrabold text-white" disabled={busy} onClick={() => setStatus(a.id, "confirmed")}>
                    <CheckIcon size={14} strokeWidth={3} />אישור
                  </button>
                  <button className="btn-ghost !px-2 text-xs text-danger" disabled={busy} onClick={() => setStatus(a.id, "cancelled")}>דחייה</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* רשת השעות */}
      <div className="card mx-4 mt-4 overflow-x-auto !rounded-3xl !p-0">
        <div className="flex min-w-fit" dir="rtl">
          {/* עמודת שעות */}
          <div className="w-12 shrink-0 border-l border-blush-100 text-left">
            <div className="h-8" />
            {gridHours.map((h) => (
              <div key={h} className="relative" style={{ height: HOUR_PX }}>
                <span className="absolute -top-2 left-1 text-[10px] text-plum-500">
                  {String(h).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {visDays.map((d) => {
            const isToday = d.toDateString() === now.toDateString();
            const dayAppts = appts.filter(
              (a) => new Date(a.starts_at).toDateString() === d.toDateString()
            );
            const dayBlocks = blocks.filter((b) => {
              const s = new Date(b.starts_at);
              const e = new Date(b.ends_at);
              return s.toDateString() === d.toDateString() || e.toDateString() === d.toDateString();
            });
            const nowH = now.getHours() + now.getMinutes() / 60;
            return (
              <div
                key={d.toISOString()}
                className={`relative border-l border-blush-100 ${
                  view === "day" ? "flex-1" : "w-[120px] flex-1 sm:w-auto"
                }`}
                style={view === "week" ? { minWidth: 104 } : undefined}
              >
                <div
                  className={`flex h-8 items-center justify-center gap-1 border-b border-blush-100 text-xs font-semibold ${
                    isToday ? "text-blush-600" : ""
                  }`}
                >
                  {view === "week" && (
                    <>
                      {DAY_NAMES[d.getDay()].slice(0, 3)}' {d.getDate()}
                    </>
                  )}
                  {view === "day" && (
                    <>
                      יום {DAY_NAMES[d.getDay()]} · {d.toLocaleDateString("he-IL")}
                    </>
                  )}
                </div>

                <div
                  className="relative cursor-pointer"
                  style={{ height: (grid.end - grid.start) * HOUR_PX }}
                  title="לחיצה על שעה ריקה = חסימה"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const h = grid.start + (e.clientY - rect.top) / HOUR_PX;
                    const startH = Math.floor(h * 2) / 2;
                    const start = `${String(Math.floor(startH)).padStart(2, "0")}:${startH % 1 ? "30" : "00"}`;
                    setBlockDraft({ date: toDateStr(d), start, end: addMinutes(start, 60), reason: "" });
                  }}
                >
                  {/* קווי שעה */}
                  {gridHours.map((h, i) => (
                    <div
                      key={h}
                      className="absolute inset-x-0 border-t border-blush-100/70"
                      style={{ top: i * HOUR_PX }}
                    />
                  ))}

                  {/* הפסקות קבועות */}
                  {wbreaks
                    .filter((b) => b.day_of_week === d.getDay())
                    .map((b) => {
                      const sh = parseInt(b.start_time, 10) + parseInt(b.start_time.slice(3, 5), 10) / 60;
                      const eh = parseInt(b.end_time, 10) + parseInt(b.end_time.slice(3, 5), 10) / 60;
                      const top = Math.max(0, (sh - grid.start) * HOUR_PX);
                      const bottom = Math.min((grid.end - grid.start) * HOUR_PX, (eh - grid.start) * HOUR_PX);
                      if (bottom <= top) return null;
                      return (
                        <div
                          key={b.id}
                          className="absolute inset-x-0.5 z-0 rounded-lg text-center text-[10px] text-gray-500"
                          style={{
                            top,
                            height: bottom - top,
                            background:
                              "repeating-linear-gradient(45deg,#f1f1f1,#f1f1f1 6px,#e5e5e5 6px,#e5e5e5 12px)",
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="leading-6">{b.label || "לא פנוי"}</span>
                        </div>
                      );
                    })}

                  {/* חסימות */}
                  {dayBlocks.map((b) => {
                    const top = Math.max(0, (hourOf(b.starts_at) - grid.start) * HOUR_PX);
                    const bottom = Math.min(
                      (grid.end - grid.start) * HOUR_PX,
                      (hourOf(b.ends_at) - grid.start) * HOUR_PX
                    );
                    if (bottom <= 0 || top >= (grid.end - grid.start) * HOUR_PX) return null;
                    return (
                      <div
                        key={b.id}
                        className="absolute inset-x-0.5 z-[5] rounded-lg text-center text-[10px] text-gray-600"
                        style={{
                          top,
                          height: bottom - top,
                          background:
                            "repeating-linear-gradient(45deg,#f1f1f1,#f1f1f1 6px,#e5e5e5 6px,#e5e5e5 12px)",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBlock(b);
                        }}
                        title="לחיצה להסרת החסימה"
                      >
                        <span className="leading-6">🚫 {b.reason || "חסום"}</span>
                      </div>
                    );
                  })}

                  {/* תורים */}
                  {dayAppts.map((a) => {
                    const top = (hourOf(a.starts_at) - grid.start) * HOUR_PX;
                    const height = Math.max(
                      24,
                      (hourOf(a.ends_at) - hourOf(a.starts_at)) * HOUR_PX - 2
                    );
                    const isPending = a.status === "pending";
                    return (
                      <button
                        key={a.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSel(a);
                        }}
                        className={`absolute inset-x-0.5 z-10 overflow-hidden rounded-xl px-2 py-1 text-right text-[11px] leading-tight transition active:scale-[0.98] ${
                          isPending
                            ? "border-[1.5px] border-dashed border-[#E0A93A] bg-[#FFF8E8] text-[#6B4A0F]"
                            : "border-r-4 border-plum-700 bg-white text-ink shadow-soft"
                        }`}
                        style={{ top, height }}
                      >
                        <div className="truncate font-bold">
                          {fmtTime(a.starts_at)} {a.client_name}
                        </div>
                        <div className="truncate opacity-80">
                          {a.services?.name}
                          {a.addons && a.addons.length > 0 && ` +${a.addons.length}`}
                          {isPending && " · ממתין ⏳"}
                        </div>
                      </button>
                    );
                  })}

                  {/* קו עכשיו */}
                  {isToday && nowH > grid.start && nowH < grid.end && (
                    <div
                      className="absolute inset-x-0 z-20 h-0.5 bg-red-500"
                      style={{ top: (nowH - grid.start) * HOUR_PX }}
                    >
                      <span className="absolute -top-1 right-0 h-2.5 w-2.5 rounded-full bg-red-500" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* אחרי אישור: הוספה ליומן גוגל */}
      {justApproved && (
        <div className="fixed inset-x-0 bottom-24 z-50 px-4">
          <div className="mx-auto flex max-w-md items-center gap-3 rounded-3xl bg-plum-900 p-4 text-white shadow-plum">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-success text-white"><CheckIcon size={20} strokeWidth={2.5} /></span>
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-extrabold">התור אושר – הלקוחה קיבלה עדכון</div>
              <div className="truncate text-xs opacity-80">{justApproved.client_name} · {fmtTime(justApproved.starts_at)}</div>
            </div>
            <a
              href={apptCalendarLink(justApproved)}
              target="_blank"
              rel="noopener"
              onClick={() => setJustApproved(null)}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-extrabold text-plum-900"
            >
              <CalendarIcon size={14} />ליומן גוגל
            </a>
            <button aria-label="סגירה" className="shrink-0 opacity-70" onClick={() => setJustApproved(null)}><XIcon size={18} /></button>
          </div>
        </div>
      )}

      {/* חסימה מהירה */}
      {blockDraft && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setBlockDraft(null)}
        >
          <div
            className="w-full max-w-md rounded-t-[32px] bg-white px-6 pb-9 pt-3 sm:rounded-[32px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-11 rounded-full bg-blush-200" />
            <h3 className="mb-1 text-lg font-extrabold">חסימת שעות</h3>
            <p className="mb-3 text-sm text-plum-500">
              יום {DAY_NAMES[localDateTime(blockDraft.date, "12:00").getDay()]} ·{" "}
              {localDateTime(blockDraft.date, "12:00").toLocaleDateString("he-IL")}
            </p>
            <div className="mb-3 flex items-center gap-2 text-sm">
              <span>מ-</span>
              <TimeSelect
                value={blockDraft.start}
                onChange={(v) =>
                  setBlockDraft({ ...blockDraft, start: v, end: v >= blockDraft.end ? addMinutes(v, 60) : blockDraft.end })
                }
              />
              <span>עד</span>
              <TimeSelect value={blockDraft.end} onChange={(v) => setBlockDraft({ ...blockDraft, end: v })} />
            </div>
            <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
              {[30, 60, 120, 180].map((m) => (
                <button
                  key={m}
                  className="chip !py-1"
                  onClick={() => setBlockDraft({ ...blockDraft, end: addMinutes(blockDraft.start, m) })}
                >
                  {durationLabel(m)}
                </button>
              ))}
              <button
                className="chip !py-1"
                onClick={() =>
                  setBlockDraft({
                    ...blockDraft,
                    start: `${String(grid.start).padStart(2, "0")}:00`,
                    end: `${String(grid.end).padStart(2, "0")}:00`,
                  })
                }
              >
                כל היום
              </button>
            </div>
            <input
              className="input mb-4"
              placeholder="סיבה (לא חובה)"
              value={blockDraft.reason}
              onChange={(e) => setBlockDraft({ ...blockDraft, reason: e.target.value })}
            />
            <div className="flex gap-2">
              <button className="btn-primary flex-1" disabled={busy || blockDraft.start >= blockDraft.end} onClick={saveBlock}>
                {busy ? "שומרת…" : "חסימה"}
              </button>
              <button className="btn-ghost" onClick={() => setBlockDraft(null)}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* פרטי תור */}
      {sel && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-md rounded-t-[32px] bg-white px-6 pb-9 pt-3 shadow-[0_-20px_60px_rgba(0,0,0,0.35)] sm:rounded-[32px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-11 rounded-full bg-blush-200" />
            <div className="flex items-center gap-3.5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-blush-100 text-2xl font-extrabold text-plum-700">
                {sel.client_name.trim().charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-xl font-extrabold leading-tight">{sel.client_name}</h3>
                <a href={`tel:${sel.client_phone}`} dir="ltr" className="block text-right text-[13px] text-muted">{sel.client_phone}</a>
              </div>
              {sel.status === "pending" ? <span className="badge-wait whitespace-nowrap">ממתין</span> : <span className="badge-ok whitespace-nowrap">מאושר</span>}
            </div>

            <div className="mt-4 flex flex-col gap-3 rounded-3xl bg-ground px-4.5 py-4" style={{ paddingInline: 18 }}>
              <div className="flex items-center gap-3">
                <CalendarIcon size={20} className="shrink-0 text-blush-500" />
                <div>
                  <div className="text-[15px] font-extrabold">
                    יום {DAY_NAMES[new Date(sel.starts_at).getDay()]}, {new Date(sel.starts_at).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })} · {fmtTime(sel.starts_at)}–{fmtTime(sel.ends_at)}
                  </div>
                  <div className="text-xs text-muted">{durationLabel((new Date(sel.ends_at).getTime() - new Date(sel.starts_at).getTime()) / 60000)}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <PlusIcon size={20} className="shrink-0 text-blush-500" />
                <div>
                  <div className="text-[15px] font-extrabold">
                    {sel.services?.name}
                    {sel.addons && sel.addons.length > 0 && " + " + sel.addons.map((x) => x.name).join(" + ")}
                  </div>
                  {sel.addons && sel.addons.length > 0 && (
                    <div className="text-xs text-muted">{sel.addons.map((x) => `${x.name} (${priceLabel(x.price, x.price_max)})`).join(", ")}</div>
                  )}
                </div>
              </div>
              {sel.notes && (
                <div className="flex items-start gap-3">
                  <MessageIcon size={20} className="shrink-0 text-blush-500" />
                  <div className="text-[13px] leading-snug text-plum-500">"{sel.notes}"</div>
                </div>
              )}
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2">
              <a href={`tel:${sel.client_phone}`} className="btn-outline !px-2"><PhoneIcon size={16} />חיוג</a>
              <a
                href={waLink(
                  sel.client_phone,
                  `היי ${sel.client_name} 💅 לגבי התור שלך ל${sel.services?.name ?? ""} ב${new Date(sel.starts_at).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "numeric" })} בשעה ${fmtTime(sel.starts_at)} – `
                )}
                target="_blank"
                rel="noopener"
                className="btn-outline !border-[#CFEBDD] !bg-success-50 !px-2 !text-success"
              >
                <WhatsAppIcon size={16} />וואטסאפ
              </a>
              <button className={`btn-outline !px-2 ${resOpen ? "!border-plum-700" : ""}`} onClick={() => setResOpen((v) => !v)}>
                <RefreshIcon size={16} />שינוי
              </button>
              <a href={apptCalendarLink(sel)} target="_blank" rel="noopener" className="btn-outline !px-2" title="הוספה ליומן גוגל">
                <CalendarIcon size={16} />יומן גוגל
              </a>
            </div>
            {resOpen && (
              <div className="mt-3 rounded-3xl border border-line p-3.5">
                <h4 className="mb-2 text-sm font-extrabold">בחרי מועד חדש</h4>
                <div className="-mx-3 mb-3 flex gap-1.5 overflow-x-auto px-3 pb-1">
                  {Array.from({ length: 21 }, (_, i) => {
                    const d = new Date();
                    d.setDate(d.getDate() + i);
                    const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                    return (
                      <button
                        key={str}
                        onClick={() => setResDate(str)}
                        className={`flex min-w-[54px] flex-col items-center rounded-xl border px-2 py-1.5 text-xs ${
                          resDate === str
                            ? "border-plum-700 bg-plum-700 text-white"
                            : "border-blush-200 bg-white"
                        }`}
                      >
                        <span>{DAY_NAMES[d.getDay()].slice(0, 3)}'</span>
                        <span className="text-sm font-bold">{d.getDate()}</span>
                      </button>
                    );
                  })}
                </div>
                {resDate &&
                  (resLoading ? (
                    <p className="text-xs text-plum-500">בודק שעות…</p>
                  ) : resSlots.length === 0 ? (
                    <p className="rounded-lg bg-blush-50 p-2 text-xs">אין שעות פנויות ביום זה</p>
                  ) : (
                    <div className="grid grid-cols-5 gap-1.5">
                      {resSlots.map((s) => (
                        <button
                          key={s.slot_start}
                          onClick={() => setResSlot(s.slot_start)}
                          className={`rounded-lg border py-1.5 text-xs font-medium ${
                            resSlot === s.slot_start
                              ? "border-plum-700 bg-plum-700 text-white"
                              : "border-blush-200 bg-white"
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  ))}
                {resError && (
                  <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{resError}</p>
                )}
                <button
                  className="btn-primary mt-3 w-full !py-2 text-sm"
                  disabled={!resSlot || busy}
                  onClick={adminMove}
                >
                  {busy ? "מעדכנת…" : "אישור המועד החדש (הלקוחה תעודכן)"}
                </button>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-2">
              {sel.status === "pending" && (
                <button
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-success text-base font-extrabold text-white shadow-[0_12px_28px_rgba(46,125,91,0.35)] transition active:scale-[0.98] disabled:opacity-40"
                  disabled={busy}
                  onClick={() => setStatus(sel.id, "confirmed")}
                >
                  <CheckIcon size={20} strokeWidth={2.5} />אישור התור – הלקוחה תקבל עדכון
                </button>
              )}
              <div className="flex items-center justify-between">
                <button className="btn-ghost text-sm text-danger" disabled={busy} onClick={() => setStatus(sel.id, "cancelled")}>
                  {sel.status === "pending" ? "דחיית הבקשה" : "ביטול התור"}
                </button>
                <button className="btn-ghost text-sm" onClick={closeModal}>סגירה</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ===== טיפולים ===== */

function ServicesTab() {
  const [services, setServices] = useState<Service[]>([]);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(60);
  const [price, setPrice] = useState(120);
  const [priceMax, setPriceMax] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ name: "", duration: 60, price: 0, priceMax: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("services").select("*").order("created_at");
    setServices((data as Service[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from("services").insert({
      name,
      duration_minutes: duration,
      price,
      price_max: priceMax === "" ? null : +priceMax,
    });
    setName("");
    setPriceMax("");
    load();
  }

  async function toggle(s: Service) {
    await supabase.from("services").update({ is_active: !s.is_active }).eq("id", s.id);
    load();
  }

  async function remove(s: Service) {
    if (!confirm(`למחוק את "${s.name}" לצמיתות?`)) return;
    const { error } = await supabase.from("services").delete().eq("id", s.id);
    if (error) {
      alert("אי אפשר למחוק טיפול שכבר נקבעו עליו תורים – אפשר להשבית אותו במקום");
      return;
    }
    load();
  }

  function startEdit(s: Service) {
    setEditingId(s.id);
    setEdit({
      name: s.name,
      duration: s.duration_minutes,
      price: Number(s.price),
      priceMax: s.price_max == null ? "" : String(Number(s.price_max)),
    });
  }

  async function saveEdit(id: string) {
    setSaving(true);
    await supabase
      .from("services")
      .update({
        name: edit.name,
        duration_minutes: edit.duration,
        price: edit.price,
        price_max: edit.priceMax === "" ? null : +edit.priceMax,
      })
      .eq("id", id);
    setSaving(false);
    setEditingId(null);
    load();
  }

  return (
    <section className="flex flex-col gap-4">
      <form onSubmit={add} className="card flex flex-col gap-3">
        <h3 className="font-bold">הוספת טיפול</h3>
        <input
          className="input"
          placeholder="שם הטיפול"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="label">משך (דקות)</label>
            <input
              className="input"
              type="number"
              min={5}
              step={5}
              value={duration}
              onChange={(e) => setDuration(+e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="label">מחיר (₪)</label>
            <input
              className="input"
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(+e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="label">עד ₪ (לא חובה)</label>
            <input
              className="input"
              type="number"
              min={0}
              placeholder="טווח"
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
            />
          </div>
        </div>
        <button className="btn-primary">הוספה</button>
      </form>

      {services.map((s) =>
        editingId === s.id ? (
          <form
            key={s.id}
            className="card flex flex-col gap-3 ring-2 ring-blush-300"
            onSubmit={(e) => {
              e.preventDefault();
              saveEdit(s.id);
            }}
          >
            <input
              className="input"
              value={edit.name}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              required
            />
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="label">משך (דקות)</label>
                <input
                  className="input"
                  type="number"
                  min={5}
                  step={5}
                  value={edit.duration}
                  onChange={(e) => setEdit({ ...edit, duration: +e.target.value })}
                />
              </div>
              <div className="flex-1">
                <label className="label">מחיר (₪)</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={edit.price}
                  onChange={(e) => setEdit({ ...edit, price: +e.target.value })}
                />
              </div>
              <div className="flex-1">
                <label className="label">עד ₪</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  placeholder="–"
                  value={edit.priceMax}
                  onChange={(e) => setEdit({ ...edit, priceMax: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary flex-1" disabled={saving}>
                {saving ? "שומרת…" : "שמירה"}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setEditingId(null)}
              >
                ביטול
              </button>
            </div>
          </form>
        ) : (
          <div
            key={s.id}
            className={`card flex items-center justify-between ${!s.is_active ? "opacity-50" : ""}`}
          >
            <div>
              <div className="font-semibold">{s.name}</div>
              <div className="text-sm text-plum-500">
                {durationLabel(s.duration_minutes)} · {priceLabel(s.price, s.price_max)}
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-1">
              <button className="btn-ghost text-sm" onClick={() => startEdit(s)}>
                עריכה
              </button>
              <button className="btn-ghost text-sm" onClick={() => toggle(s)}>
                {s.is_active ? "השבתה" : "הפעלה"}
              </button>
              <button
                className="btn-ghost text-sm text-red-700"
                onClick={() => remove(s)}
              >
                מחיקה
              </button>
            </div>
          </div>
        )
      )}
    </section>
  );
}

/* ===== תוספות ===== */

function AddonsTab() {
  const [addons, setAddons] = useState<Addon[]>([]);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(15);
  const [price, setPrice] = useState(20);
  const [priceMax, setPriceMax] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ name: "", duration: 0, price: 0, priceMax: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("addons").select("*").order("created_at");
    setAddons((data as Addon[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from("addons").insert({
      name,
      duration_minutes: duration,
      price,
      price_max: priceMax === "" ? null : +priceMax,
    });
    setName("");
    setPriceMax("");
    load();
  }

  async function toggle(a: Addon) {
    await supabase.from("addons").update({ is_active: !a.is_active }).eq("id", a.id);
    load();
  }

  async function remove(a: Addon) {
    if (!confirm(`למחוק את התוספת "${a.name}"?`)) return;
    await supabase.from("addons").delete().eq("id", a.id);
    load();
  }

  function startEdit(a: Addon) {
    setEditingId(a.id);
    setEdit({
      name: a.name,
      duration: a.duration_minutes,
      price: Number(a.price),
      priceMax: a.price_max == null ? "" : String(Number(a.price_max)),
    });
  }

  async function saveEdit(id: string) {
    setSaving(true);
    await supabase
      .from("addons")
      .update({
        name: edit.name,
        duration_minutes: edit.duration,
        price: edit.price,
        price_max: edit.priceMax === "" ? null : +edit.priceMax,
      })
      .eq("id", id);
    setSaving(false);
    setEditingId(null);
    load();
  }

  const fields = (
    v: { duration: number; price: number; priceMax: string },
    set: (k: "duration" | "price" | "priceMax", val: number | string) => void
  ) => (
    <div className="flex gap-3">
      <div className="flex-1">
        <label className="label">תוספת זמן (דק')</label>
        <input
          className="input"
          type="number"
          min={0}
          step={5}
          value={v.duration}
          onChange={(e) => set("duration", +e.target.value)}
        />
      </div>
      <div className="flex-1">
        <label className="label">מחיר (₪)</label>
        <input
          className="input"
          type="number"
          min={0}
          value={v.price}
          onChange={(e) => set("price", +e.target.value)}
        />
      </div>
      <div className="flex-1">
        <label className="label">עד ₪ (לא חובה)</label>
        <input
          className="input"
          type="number"
          min={0}
          placeholder="טווח"
          value={v.priceMax}
          onChange={(e) => set("priceMax", e.target.value)}
        />
      </div>
    </div>
  );

  return (
    <section className="flex flex-col gap-4">
      <p className="text-sm text-plum-500">
        תוספות מוצעות ללקוחה אחרי בחירת הטיפול. תוספת הזמן נלקחת בחשבון ביומן.
      </p>
      <form onSubmit={add} className="card flex flex-col gap-3">
        <h3 className="font-bold">הוספת תוספת</h3>
        <input
          className="input"
          placeholder="שם התוספת (למשל: קישוטים)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        {fields({ duration, price, priceMax }, (k, v) => {
          if (k === "duration") setDuration(v as number);
          else if (k === "price") setPrice(v as number);
          else setPriceMax(v as string);
        })}
        <button className="btn-primary">הוספה</button>
      </form>

      {addons.map((a) =>
        editingId === a.id ? (
          <form
            key={a.id}
            className="card flex flex-col gap-3 ring-2 ring-blush-300"
            onSubmit={(e) => {
              e.preventDefault();
              saveEdit(a.id);
            }}
          >
            <input
              className="input"
              value={edit.name}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              required
            />
            {fields(edit, (k, v) => setEdit({ ...edit, [k === "priceMax" ? "priceMax" : k]: v }))}
            <div className="flex gap-2">
              <button className="btn-primary flex-1" disabled={saving}>
                {saving ? "שומרת…" : "שמירה"}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setEditingId(null)}>
                ביטול
              </button>
            </div>
          </form>
        ) : (
          <div
            key={a.id}
            className={`card flex items-center justify-between ${!a.is_active ? "opacity-50" : ""}`}
          >
            <div>
              <div className="font-semibold">{a.name}</div>
              <div className="text-sm text-plum-500">
                {a.duration_minutes > 0 ? `+${durationLabel(a.duration_minutes)} · ` : ""}
                {priceLabel(a.price, a.price_max)}
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-1">
              <button className="btn-ghost text-sm" onClick={() => startEdit(a)}>
                עריכה
              </button>
              <button className="btn-ghost text-sm" onClick={() => toggle(a)}>
                {a.is_active ? "השבתה" : "הפעלה"}
              </button>
              <button className="btn-ghost text-sm text-red-700" onClick={() => remove(a)}>
                מחיקה
              </button>
            </div>
          </div>
        )
      )}
      {addons.length === 0 && (
        <p className="text-center text-sm text-plum-500">אין תוספות עדיין</p>
      )}
    </section>
  );
}

/* ===== שעות עבודה ===== */

type DayRow = { enabled: boolean; start: string; end: string };

function HoursTab() {
  const [rows, setRows] = useState<DayRow[]>(
    Array.from({ length: 7 }, () => ({ enabled: false, start: "09:00", end: "19:00" }))
  );
  const [buffer, setBuffer] = useState(0);
  const [leadHours, setLeadHours] = useState(0);
  const [maxDays, setMaxDays] = useState(21);
  const [openUntil, setOpenUntil] = useState(""); // YYYY-MM-DD או ריק
  const [saving, setSaving] = useState(false);
  const [breaks, setBreaks] = useState<WeeklyBreak[]>([]);
  const [newBreak, setNewBreak] = useState<{ day: number; start: string; end: string; label: string } | null>(null);

  const loadBreaks = useCallback(async () => {
    const { data } = await supabase.from("weekly_breaks").select("*").order("start_time");
    setBreaks((data as WeeklyBreak[]) ?? []);
  }, []);

  useEffect(() => {
    loadBreaks();
  }, [loadBreaks]);

  async function addBreak() {
    if (!newBreak || newBreak.start >= newBreak.end) return;
    await supabase.from("weekly_breaks").insert({
      day_of_week: newBreak.day,
      start_time: newBreak.start,
      end_time: newBreak.end,
      label: newBreak.label || null,
    });
    setNewBreak(null);
    loadBreaks();
  }

  async function removeBreak(id: string) {
    await supabase.from("weekly_breaks").delete().eq("id", id);
    loadBreaks();
  }
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase
      .from("working_hours")
      .select("*")
      .then(({ data }) => {
        const whs = (data as WorkingHour[]) ?? [];
        setRows((prev) =>
          prev.map((r, i) => {
            const wh = whs.find((w) => w.day_of_week === i);
            return wh
              ? { enabled: true, start: wh.start_time.slice(0, 5), end: wh.end_time.slice(0, 5) }
              : { ...r, enabled: false };
          })
        );
      });
    supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["buffer_minutes", "min_lead_hours", "max_days_ahead", "booking_open_until"])
      .then(({ data }) => {
        (data as { key: string; value: string }[] | null)?.forEach((r) => {
          if (r.key === "buffer_minutes") setBuffer(Number(r.value) || 0);
          if (r.key === "min_lead_hours") setLeadHours(Number(r.value) || 0);
          if (r.key === "max_days_ahead") setMaxDays(Number(r.value) || 0);
          if (r.key === "booking_open_until") setOpenUntil(r.value || "");
        });
      });
  }, []);

  async function save() {
    setSaving(true);
    await supabase.from("working_hours").delete().gte("day_of_week", 0);
    const inserts = rows
      .map((r, i) => ({ day_of_week: i, start_time: r.start, end_time: r.end, enabled: r.enabled }))
      .filter((r) => r.enabled)
      .map(({ enabled, ...rest }) => rest);
    if (inserts.length) await supabase.from("working_hours").insert(inserts);
    await supabase.from("app_settings").upsert(
      [
        { key: "buffer_minutes", value: String(buffer) },
        { key: "min_lead_hours", value: String(leadHours) },
        { key: "max_days_ahead", value: String(maxDays) },
        { key: "booking_open_until", value: openUntil },
      ],
      { onConflict: "key" }
    );
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <section className="card flex flex-col gap-3">
      <h3 className="font-bold">שעות קבלה קבועות</h3>
      <p className="text-xs text-plum-500">
        לכל יום אפשר להוסיף גם שעות לא פנויות קבועות (הפסקת צהריים, איסוף ילדים…)
      </p>
      {rows.map((r, i) => (
        <div key={i} className="flex flex-col gap-1.5 border-b border-blush-50 pb-2">
        <div className="flex items-center gap-3 text-sm">
          <label className="flex w-20 items-center gap-2">
            <input
              type="checkbox"
              checked={r.enabled}
              onChange={(e) =>
                setRows((rs) => rs.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)))
              }
            />
            {DAY_NAMES[i]}
          </label>
          <input
            type="time"
            className="input !w-auto !py-1.5"
            value={r.start}
            disabled={!r.enabled}
            onChange={(e) =>
              setRows((rs) => rs.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))
            }
          />
          <span>עד</span>
          <input
            type="time"
            className="input !w-auto !py-1.5"
            value={r.end}
            disabled={!r.enabled}
            onChange={(e) =>
              setRows((rs) => rs.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))
            }
          />
        </div>

        {r.enabled && (
          <div className="flex flex-wrap items-center gap-1.5 pr-20 text-xs">
            {breaks
              .filter((b) => b.day_of_week === i)
              .map((b) => (
                <span
                  key={b.id}
                  className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-gray-600"
                >
                  🚫 {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}
                  {b.label && <span className="text-gray-400">· {b.label}</span>}
                  <button
                    type="button"
                    className="mr-1 text-red-600"
                    onClick={() => removeBreak(b.id)}
                    title="הסרה"
                  >
                    ✕
                  </button>
                </span>
              ))}
            {newBreak?.day === i ? (
              <span className="inline-flex flex-wrap items-center gap-1.5 rounded-xl border border-blush-200 p-1.5">
                <input
                  type="time"
                  className="input !w-auto !py-1 !text-xs"
                  value={newBreak.start}
                  onChange={(e) => setNewBreak({ ...newBreak, start: e.target.value })}
                />
                <span>עד</span>
                <input
                  type="time"
                  className="input !w-auto !py-1 !text-xs"
                  value={newBreak.end}
                  onChange={(e) => setNewBreak({ ...newBreak, end: e.target.value })}
                />
                <input
                  className="input !w-28 !py-1 !text-xs"
                  placeholder="סיבה (לא חובה)"
                  value={newBreak.label}
                  onChange={(e) => setNewBreak({ ...newBreak, label: e.target.value })}
                />
                <button type="button" className="btn-primary !px-3 !py-1 text-xs" onClick={addBreak}>
                  הוספה
                </button>
                <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setNewBreak(null)}>
                  ביטול
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="rounded-full border border-dashed border-blush-300 px-2.5 py-1 text-plum-500 hover:bg-blush-50"
                onClick={() => setNewBreak({ day: i, start: "13:00", end: "14:00", label: "" })}
              >
                + שעות לא פנויות
              </button>
            )}
          </div>
        )}
        </div>
      ))}
      <div className="mt-2 border-t border-blush-100 pt-3">
        <label className="label">מרווח מינימום בין תורים (דקות)</label>
        <div className="flex items-center gap-3">
          <input
            className="input !w-24"
            type="number"
            min={0}
            max={120}
            step={5}
            value={buffer}
            onChange={(e) => setBuffer(Math.max(0, +e.target.value))}
          />
          <span className="text-xs text-plum-500">
            זמן התארגנות בין לקוחה ללקוחה – משפיע על השעות שמוצעות
          </span>
        </div>
      </div>
      <div className="border-t border-blush-100 pt-3">
        <label className="label">זמן מינימום מראש לקביעת תור (שעות)</label>
        <div className="flex items-center gap-3">
          <input
            className="input !w-24"
            type="number"
            min={0}
            max={168}
            step={1}
            value={leadHours}
            onChange={(e) => setLeadHours(Math.max(0, +e.target.value))}
          />
          <span className="text-xs text-plum-500">
            למשל 8 = לקוחה לא תוכל לקבוע תור שמתחיל בעוד פחות מ-8 שעות. 0 = בלי מגבלה.
            לא חל עלייך בהזזת תורים מהיומן.
          </span>
        </div>
      </div>
      <div className="border-t border-blush-100 pt-3">
        <label className="label">פתיחת היומן ללקוחות</label>
        {(() => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const byMax = maxDays > 0 ? new Date(today.getTime() + maxDays * 864e5) : null;
          const byUntil = openUntil ? localDateTime(openUntil, "12:00") : null;
          const eff =
            byMax && byUntil ? (byMax < byUntil ? byMax : byUntil) : byMax ?? byUntil;
          const addDays = (n: number) => {
            const base = openUntil ? localDateTime(openUntil, "12:00") : today;
            const d = new Date(Math.max(base.getTime(), today.getTime()) + n * 864e5);
            setOpenUntil(toDateStr(d));
          };
          const endOfMonth = (offset: number) => {
            const d = new Date(today.getFullYear(), today.getMonth() + offset + 1, 0);
            setOpenUntil(toDateStr(d));
          };
          return (
            <div className="flex flex-col gap-2 text-sm">
              <div className="rounded-xl bg-blush-50 p-2.5">
                הלקוחות יכולות לקבוע כרגע עד:{" "}
                <b>
                  {eff
                    ? `יום ${DAY_NAMES[eff.getDay()]} ${eff.toLocaleDateString("he-IL")}`
                    : "בלי הגבלה"}
                </b>
                {eff && eff < today && (
                  <span className="text-red-700"> · היומן סגור לקביעה! פתחי תאריכים</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="w-28">פתוח עד תאריך:</span>
                <input
                  type="date"
                  className="input !w-auto !py-1.5"
                  value={openUntil}
                  min={toDateStr(today)}
                  onChange={(e) => setOpenUntil(e.target.value)}
                />
                {openUntil && (
                  <button type="button" className="btn-ghost !px-2 text-xs" onClick={() => setOpenUntil("")}>
                    ✕ נקה
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                <button type="button" className="chip !py-1" onClick={() => addDays(7)}>+ שבוע</button>
                <button type="button" className="chip !py-1" onClick={() => addDays(14)}>+ שבועיים</button>
                <button type="button" className="chip !py-1" onClick={() => addDays(30)}>+ חודש</button>
                <button type="button" className="chip !py-1" onClick={() => endOfMonth(0)}>עד סוף החודש</button>
                <button type="button" className="chip !py-1" onClick={() => endOfMonth(1)}>עד סוף החודש הבא</button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="w-28">מקסימום קדימה:</span>
                <input
                  className="input !w-20 !py-1.5"
                  type="number"
                  min={0}
                  max={365}
                  value={maxDays}
                  onChange={(e) => setMaxDays(Math.max(0, +e.target.value))}
                />
                <span className="text-xs text-plum-500">ימים (0 = בלי הגבלה)</span>
              </div>
              <p className="text-xs text-plum-500">
                הלקוחות רואות עד המוקדם מבין השניים. את עצמך יכולה להזיז תורים לכל תאריך.
              </p>
            </div>
          );
        })()}
      </div>
      <button className="btn-primary mt-2" onClick={save} disabled={saving}>
        {saving ? "שומרת…" : saved ? "נשמר ✓" : "שמירה"}
      </button>
    </section>
  );
}

/* ===== חסימות ===== */

function BlockedTab() {
  const [blocks, setBlocks] = useState<BlockedTime[]>([]);
  const [dateStr, setDateStr] = useState(() => toDateStr(new Date()));
  const [start, setStart] = useState("12:00");
  const [end, setEnd] = useState("13:00");
  const [allDay, setAllDay] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("blocked_times")
      .select("*")
      .gte("ends_at", new Date().toISOString())
      .order("starts_at");
    setBlocks((data as BlockedTime[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const s = allDay ? "00:00" : start;
    const en = allDay ? "23:59" : end;
    if (s >= en) return;
    setSaving(true);
    await supabase.from("blocked_times").insert({
      starts_at: localDateTime(dateStr, s).toISOString(),
      ends_at: localDateTime(dateStr, en).toISOString(),
      reason: reason || null,
    });
    setSaving(false);
    setReason("");
    load();
  }

  async function remove(id: string) {
    await supabase.from("blocked_times").delete().eq("id", id);
    load();
  }

  const selected = localDateTime(dateStr, "12:00");

  return (
    <section className="flex flex-col gap-4">
      <p className="text-sm text-plum-500">
        שעות שאת לא פנויה בתאריך מסוים. טיפ: אפשר גם ללחוץ על שעה ריקה ביומן.
      </p>

      <form onSubmit={add} className="card flex flex-col gap-3">
        <h3 className="font-bold">חסימה חדשה</h3>

        <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1">
          {days.map((d) => {
            const str = toDateStr(d);
            const isToday = d.toDateString() === new Date().toDateString();
            return (
              <button
                type="button"
                key={str}
                onClick={() => setDateStr(str)}
                className={`flex min-w-[56px] flex-col items-center rounded-xl border px-2 py-1.5 text-xs ${
                  dateStr === str
                    ? "border-plum-700 bg-plum-700 text-white"
                    : isToday
                    ? "border-blush-300 bg-blush-50"
                    : "border-blush-200 bg-white"
                }`}
              >
                <span>{DAY_NAMES[d.getDay()].slice(0, 3)}'</span>
                <span className="text-base font-bold">{d.getDate()}</span>
                <span className="text-[10px]">{d.toLocaleDateString("he-IL", { month: "short" })}</span>
              </button>
            );
          })}
        </div>

        <div className="text-sm font-medium">
          יום {DAY_NAMES[selected.getDay()]} · {selected.toLocaleDateString("he-IL")}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          כל היום
        </label>

        {!allDay && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>מ-</span>
            <TimeSelect
              value={start}
              onChange={(v) => {
                setStart(v);
                if (v >= end) setEnd(addMinutes(v, 60));
              }}
            />
            <span>עד</span>
            <TimeSelect value={end} onChange={setEnd} />
          </div>
        )}

        <input
          className="input"
          placeholder="סיבה (לא חובה) – למשל: רופא, אירוע"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <button className="btn-primary" disabled={saving}>
          {saving ? "שומרת…" : "חסימה"}
        </button>
      </form>

      <h3 className="font-bold">חסימות קרובות</h3>
      {(() => {
        // קיבוץ לפי יום
        const groups: Record<string, BlockedTime[]> = {};
        blocks.forEach((b) => {
          const k = toDateStr(new Date(b.starts_at));
          (groups[k] ??= []).push(b);
        });
        return Object.entries(groups).map(([k, list]) => {
          const d = localDateTime(k, "12:00");
          const isToday = d.toDateString() === new Date().toDateString();
          return (
            <div key={k} className="card !py-3">
              <div className="mb-2 flex items-center justify-between">
                <span className={`text-sm font-bold ${isToday ? "text-blush-600" : ""}`}>
                  יום {DAY_NAMES[d.getDay()]} · {d.toLocaleDateString("he-IL")}
                  {isToday && " (היום)"}
                </span>
                <button
                  type="button"
                  className="text-xs text-plum-500 hover:text-plum-700"
                  onClick={() => {
                    setDateStr(k);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  + עוד שעות ביום זה
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {list.map((b) => {
                  const st = new Date(b.starts_at);
                  const en = new Date(b.ends_at);
                  const wholeDay = st.getHours() === 0 && en.getHours() === 23;
                  return (
                    <span
                      key={b.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700"
                      title={b.reason ?? ""}
                    >
                      🚫 {wholeDay ? "כל היום" : `${fmtTime(b.starts_at)}–${fmtTime(b.ends_at)}`}
                      {b.reason && <span className="text-gray-400">· {b.reason}</span>}
                      <button
                        type="button"
                        className="mr-0.5 text-red-600"
                        onClick={() => remove(b.id)}
                        title="הסרה"
                      >
                        ✕
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        });
      })()}
      {blocks.length === 0 && <p className="text-center text-sm text-plum-500">אין חסימות קרובות</p>}
    </section>
  );
}

/* ===== לקוחות ===== */

function ClientsTab() {
  const [clients, setClients] = useState<Client[]>([]);
  const [pushPhones, setPushPhones] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const [{ data: cs }, { data: subs }] = await Promise.all([
      supabase.from("clients").select("*").order("created_at", { ascending: false }),
      supabase.from("push_subscriptions").select("client_phone").eq("is_admin", false),
    ]);
    setClients((cs as Client[]) ?? []);
    setPushPhones(
      new Set(
        ((subs as { client_phone: string | null }[]) ?? [])
          .map((s) => s.client_phone)
          .filter((p): p is string => !!p)
      )
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function removeClient(c: Client) {
    if (!confirm(`למחוק את ${c.name} מרשימת הלקוחות?\n(התורים שלה ביומן יישארו)`)) return;
    await supabase.from("clients").delete().eq("id", c.id);
    load();
  }

  const filtered = clients.filter(
    (c) => c.name.includes(q) || c.phone.includes(q)
  );
  const installedCount = clients.filter((c) => c.installed_at).length;
  const pushCount = clients.filter((c) => pushPhones.has(c.phone)).length;

  return (
    <section className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="card !p-3">
          <div className="text-xl font-bold">{clients.length}</div>
          <div className="text-plum-500">לקוחות</div>
        </div>
        <div className="card !p-3">
          <div className="text-xl font-bold text-green-700">{installedCount}</div>
          <div className="text-plum-500">📲 מותקן</div>
        </div>
        <div className="card !p-3">
          <div className="text-xl font-bold text-green-700">{pushCount}</div>
          <div className="text-plum-500">התראות</div>
        </div>
      </div>
      <input
        className="input"
        placeholder="חיפוש לפי שם או טלפון…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {filtered.map((c) => (
        <div key={c.id} className="card flex items-center justify-between gap-2 text-sm">
          <div className="min-w-0">
            <div className="font-semibold">{c.name}</div>
            <a href={`tel:${c.phone}`} className="text-blush-600" dir="ltr">
              {c.phone}
            </a>
            <div className="text-xs text-plum-500">
              הצטרפה {new Date(c.created_at).toLocaleDateString("he-IL")}
              {c.last_seen_at &&
                ` · נראתה ${new Date(c.last_seen_at).toLocaleDateString("he-IL")}`}
            </div>
            <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
              <span
                className={`rounded-full px-2 py-0.5 ${
                  c.installed_at ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"
                }`}
                title={c.installed_at ? `הותקן ${new Date(c.installed_at).toLocaleDateString("he-IL")}` : ""}
              >
                {c.installed_at
                  ? `📲 מותקן${c.platform === "ios" ? " · אייפון" : c.platform === "android" ? " · אנדרואיד" : ""}`
                  : "לא מותקן"}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 ${
                  pushPhones.has(c.phone) ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"
                }`}
              >
                {pushPhones.has(c.phone) ? "התראות פעילות" : "בלי התראות"}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <a
              href={waLink(c.phone, `היי ${c.name} 💅`)}
              target="_blank"
              rel="noopener"
              className="rounded-full bg-green-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-green-400"
            >
              וואטסאפ
            </a>
            <button
              className="btn-ghost text-xs text-red-700"
              onClick={() => removeClient(c)}
            >
              מחיקה
            </button>
          </div>
        </div>
      ))}
      {filtered.length === 0 && <p className="text-center text-sm text-plum-500">אין לקוחות עדיין</p>}
    </section>
  );
}

/* ===== הודעות לכל הלקוחות ===== */

const TITLE_MAX = 40;
const BODY_MAX = 140;

const TEMPLATES: { title: string; body: string }[] = [
  { title: "התפנה תור היום! 🏃‍♀️", body: "התפנה תור היום – ראשונה שתופסת 💅 כנסי לאפליקציה וקבעי" },
  { title: "נפתחו תורים לשבוע הבא 📅", body: "פתחתי את היומן לשבוע הבא – מהרי לתפוס את השעה שנוחה לך 💕" },
  { title: "מבצע לזמן מוגבל 🎁", body: "השבוע תוספת קישוטים במתנה לכל לק ג'ל! קבעי תור עכשיו" },
  { title: "חג שמח! ✨", body: "מאחלת לך חג שמח ומלא יופי 💕 נתראה אחרי החג" },
  { title: "שינוי בשעות הפעילות ⏰", body: "שימי לב: השבוע אני עובדת בשעות שונות. בדקי את השעות הפנויות באפליקציה" },
  { title: "מתגעגעת 💕", body: "עבר זמן מהביקור האחרון שלך… בואי נרענן את הציפורניים 💅" },
];

type Broadcast = { id: string; title: string; body: string; sent_count: number; created_at: string };

function BroadcastTab() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [recipients, setRecipients] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [history, setHistory] = useState<Broadcast[]>([]);

  const load = useCallback(async () => {
    const [{ count }, { data }] = await Promise.all([
      supabase
        .from("push_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("is_admin", false),
      supabase.from("broadcasts").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    setRecipients(count ?? 0);
    setHistory((data as Broadcast[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function send() {
    setSending(true);
    setResult(null);
    const { data, error } = await supabase.functions.invoke("send-push", {
      body: { type: "broadcast", title: title.trim(), body: body.trim() },
    });
    setSending(false);
    setConfirming(false);
    if (error || !data?.ok) {
      setResult("השליחה נכשלה, נסי שוב");
      return;
    }
    setResult(`נשלח ל-${data.sent} מכשירים ✓`);
    setTitle("");
    setBody("");
    load();
  }

  const canSend = body.trim().length > 0 && !sending;

  return (
    <section className="flex flex-col gap-4">
      <p className="text-sm text-plum-500">
        הודעת פוש לכל הלקוחות שהפעילו התראות. כרגע:{" "}
        <b>{recipients === null ? "…" : `${recipients} מכשירים`}</b>
      </p>

      <div className="card flex flex-col gap-3">
        <h3 className="font-bold">הודעות מוכנות</h3>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATES.map((t) => (
            <button
              key={t.title}
              className={`chip !py-1.5 text-xs ${title === t.title && body === t.body ? "chip-active" : ""}`}
              onClick={() => {
                setTitle(t.title);
                setBody(t.body);
                setResult(null);
              }}
            >
              {t.title}
            </button>
          ))}
        </div>

        <div>
          <label className="label">
            כותרת{" "}
            <span className={`text-xs ${title.length > TITLE_MAX ? "text-red-600" : "text-plum-500"}`}>
              ({title.length}/{TITLE_MAX})
            </span>
          </label>
          <input
            className="input"
            value={title}
            maxLength={TITLE_MAX}
            placeholder="למשל: התפנה תור היום! 🏃‍♀️"
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label className="label">
            תוכן ההודעה{" "}
            <span className={`text-xs ${body.length > BODY_MAX ? "text-red-600" : "text-plum-500"}`}>
              ({body.length}/{BODY_MAX})
            </span>
          </label>
          <textarea
            className="input"
            rows={3}
            value={body}
            maxLength={BODY_MAX}
            placeholder="כתבי כאן הודעה חופשית…"
            onChange={(e) => setBody(e.target.value)}
          />
          <p className="mt-1 text-xs text-plum-500">
            טיפ: הודעות קצרות נקראות יותר. באייפון מוצגות כ-4 שורות.
          </p>
        </div>

        {/* תצוגה מקדימה */}
        {(title || body) && (
          <div>
            <div className="label">ככה זה ייראה בטלפון</div>
            <div className="flex items-start gap-3 rounded-2xl bg-gray-100 p-3 shadow-inner">
              <Image src="/icon-192.png" alt="" width={36} height={36} className="rounded-lg" />
              <div className="min-w-0 flex-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="truncate font-semibold">{title || "Ariel Nails 💅"}</span>
                  <span className="text-[10px] text-gray-500">כעת</span>
                </div>
                <div className="whitespace-pre-wrap text-gray-700">{body}</div>
              </div>
            </div>
          </div>
        )}

        <button className="btn-primary" disabled={!canSend} onClick={() => setConfirming(true)}>
          שליחה לכל הלקוחות
        </button>
        {result && <p className="text-center text-sm text-plum-500">{result}</p>}
      </div>

      {history.length > 0 && (
        <div>
          <h3 className="mb-2 font-bold">הודעות שנשלחו</h3>
          <div className="card divide-y divide-blush-100 !p-0 text-sm">
            {history.map((h) => (
              <div key={h.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{h.title}</span>
                  <span className="text-xs text-plum-500">
                    {new Date(h.created_at).toLocaleDateString("he-IL")} · {h.sent_count} מכשירים
                  </span>
                </div>
                <div className="text-plum-500">{h.body}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* מסך אימות */}
      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => !sending && setConfirming(false)}
        >
          <div
            className="w-full max-w-md rounded-t-[32px] bg-white px-6 pb-9 pt-3 sm:rounded-[32px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-11 rounded-full bg-blush-200" />
            <h3 className="mb-1 text-lg font-extrabold">לשלוח לכל הלקוחות?</h3>
            <p className="mb-3 text-sm text-plum-500">
              ההודעה תישלח עכשיו ל-<b>{recipients ?? 0} מכשירים</b>. אי אפשר לבטל אחרי השליחה.
            </p>
            <div className="mb-4 rounded-2xl bg-gray-100 p-3 text-sm">
              <div className="font-semibold">{title || "Ariel Nails 💅"}</div>
              <div className="whitespace-pre-wrap text-gray-700">{body}</div>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary flex-1" disabled={sending} onClick={send}>
                {sending ? "שולחת…" : "כן, שלחי"}
              </button>
              <button className="btn-ghost" disabled={sending} onClick={() => setConfirming(false)}>
                חזרה לעריכה
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ===== סקירה (דשבורד) ===== */

type PricedAppt = Appointment & { est: number; minutes: number };

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function ils(n: number) { return "₪" + Math.round(n).toLocaleString("he-IL"); }

function OverviewTab({ goCalendar }: { goCalendar: () => void }) {
  const [appts, setAppts] = useState<PricedAppt[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [hours, setHours] = useState<WorkingHour[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const from = addDays(startOfDay(new Date()), -90).toISOString();
      const to = addDays(startOfDay(new Date()), 61).toISOString();
      const [{ data: a }, { data: svc }, { data: c }, { data: wh }] = await Promise.all([
        supabase.from("appointments").select("*, services(name)").gte("starts_at", from).lt("starts_at", to).order("starts_at"),
        supabase.from("services").select("*"),
        supabase.from("clients").select("*"),
        supabase.from("working_hours").select("*"),
      ]);
      const services = (svc as Service[]) ?? [];
      const priced = ((a as Appointment[]) ?? []).map((x) => {
        const sv = services.find((s) => s.id === x.service_id);
        const est = Number(sv?.price ?? 0) + (x.addons ?? []).reduce((t, ad) => t + Number(ad.price), 0);
        const minutes = (new Date(x.ends_at).getTime() - new Date(x.starts_at).getTime()) / 60000;
        return { ...x, est, minutes };
      });
      setAppts(priced);
      setClients((c as Client[]) ?? []);
      setHours((wh as WorkingHour[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const now = new Date();
  const today0 = startOfDay(now);
  const weekStart = startOfWeek(now);
  const weekEnd = addDays(weekStart, 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const live = appts.filter((a) => a.status !== "cancelled");
  const inRange = (list: PricedAppt[], s: Date, e: Date) => list.filter((a) => { const t = new Date(a.starts_at); return t >= s && t < e; });
  const sum = (list: PricedAppt[]) => list.reduce((t, a) => t + a.est, 0);

  const todayList = inRange(live, today0, addDays(today0, 1));
  const weekList = inRange(live, weekStart, weekEnd);
  const monthList = inRange(live, monthStart, monthEnd);
  const prevMonthList = inRange(live, prevMonthStart, monthStart);

  const done = (list: PricedAppt[]) => list.filter((a) => new Date(a.ends_at) <= now && a.status === "confirmed");
  const ahead = (list: PricedAppt[]) => list.filter((a) => new Date(a.ends_at) > now);

  const forecast30 = inRange(live, now, addDays(now, 30));
  const forecastConfirmed = forecast30.filter((a) => a.status === "confirmed");
  const forecastPending = forecast30.filter((a) => a.status === "pending");

  const pendingAll = appts.filter((a) => a.status === "pending" && new Date(a.starts_at) > now);
  const last30 = inRange(appts, addDays(today0, -30), now);
  const cancelRate = last30.length ? Math.round((last30.filter((a) => a.status === "cancelled").length / last30.length) * 100) : 0;
  const newClientsMonth = clients.filter((c) => new Date(c.created_at) >= monthStart).length;

  // תפוסה השבוע: דקות תורים / דקות עבודה
  const workMinutesWeek = hours.reduce((t, w) => {
    const [sh, sm] = w.start_time.split(":").map(Number);
    const [eh, em] = w.end_time.split(":").map(Number);
    return t + (eh * 60 + em - (sh * 60 + sm));
  }, 0);
  const bookedMinutesWeek = weekList.reduce((t, a) => t + a.minutes, 0);
  const occupancy = workMinutesWeek ? Math.min(100, Math.round((bookedMinutesWeek / workMinutesWeek) * 100)) : 0;

  // 14 ימים: 7 אחורה + 7 קדימה
  const barDays = Array.from({ length: 14 }, (_, i) => addDays(today0, i - 6));
  const bars = barDays.map((d) => {
    const list = inRange(live, d, addDays(d, 1));
    return { d, value: sum(list), count: list.length, future: d > today0, isToday: d.getTime() === today0.getTime() };
  });
  const barMax = Math.max(1, ...bars.map((b) => b.value));

  // טיפולים מובילים (90 יום)
  const svcCounts: Record<string, { n: number; rev: number }> = {};
  live.filter((a) => new Date(a.starts_at) <= now).forEach((a) => {
    const k = a.services?.name ?? "אחר";
    svcCounts[k] = { n: (svcCounts[k]?.n ?? 0) + 1, rev: (svcCounts[k]?.rev ?? 0) + a.est };
  });
  const topServices = Object.entries(svcCounts).sort((a, b) => b[1].n - a[1].n).slice(0, 4);
  const topMax = Math.max(1, ...topServices.map(([, v]) => v.n));

  // לקוחות לחזרה: ביקור אחרון לפני 6+ שבועות ובלי תור עתידי
  const lastByPhone: Record<string, PricedAppt> = {};
  const hasFuture = new Set<string>();
  live.forEach((a) => {
    const t = new Date(a.starts_at);
    if (t > now) hasFuture.add(a.client_phone);
    else if (!lastByPhone[a.client_phone] || new Date(lastByPhone[a.client_phone].starts_at) < t) lastByPhone[a.client_phone] = a;
  });
  const winBack = Object.values(lastByPhone)
    .filter((a) => !hasFuture.has(a.client_phone) && now.getTime() - new Date(a.starts_at).getTime() > 42 * 864e5)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, 5);

  const nextToday = todayList.filter((a) => new Date(a.ends_at) > now).slice(0, 4);

  if (loading) return <p className="py-10 text-center text-muted">טוען נתונים…</p>;

  return (
    <section className="flex flex-col gap-4 px-4 pt-4">
      {/* הכנסות */}
      <div className="grid grid-cols-3 gap-2.5">
        <StatTile label="היום" value={ils(sum(todayList))} sub={`${todayList.length} תורים`} />
        <StatTile label="השבוע" value={ils(sum(weekList))} sub={`${ils(sum(done(weekList)))} בוצע · ${ils(sum(ahead(weekList)))} צפוי`} />
        <StatTile label="החודש" value={ils(sum(monthList))} sub={prevMonthList.length ? `חודש שעבר ${ils(sum(prevMonthList))}` : `${monthList.length} תורים`} accent />
      </div>

      {/* צפי + תפוסה */}
      <div className="card-dark flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold opacity-80">צפי 30 יום קדימה</div>
          <div className="mt-0.5 text-3xl font-extrabold leading-none">{ils(sum(forecastConfirmed))}</div>
          <div className="mt-1.5 text-xs opacity-85">
            {forecastConfirmed.length} מאושרים
            {forecastPending.length > 0 && ` · עוד ${ils(sum(forecastPending))} ב-${forecastPending.length} ממתינים`}
          </div>
        </div>
        <div className="flex flex-col items-center">
          <div className="relative flex h-[72px] w-[72px] items-center justify-center rounded-full"
            style={{ background: `conic-gradient(#D98E8A ${occupancy * 3.6}deg, rgba(255,255,255,0.14) 0)` }}>
            <div className="flex h-[56px] w-[56px] flex-col items-center justify-center rounded-full bg-plum-700">
              <span className="text-base font-extrabold leading-none">{occupancy}%</span>
            </div>
          </div>
          <span className="mt-1 text-[11px] opacity-80">תפוסה השבוע</span>
        </div>
      </div>

      {/* מדדים קטנים */}
      <div className="grid grid-cols-3 gap-2.5">
        <MiniStat label="ממתינים לאישור" value={String(pendingAll.length)} warn={pendingAll.length > 0} onClick={goCalendar} />
        <MiniStat label="לקוחות חדשות החודש" value={String(newClientsMonth)} />
        <MiniStat label="ביטולים (30 יום)" value={`${cancelRate}%`} warn={cancelRate >= 20} />
      </div>

      {/* גרף 14 יום */}
      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="section-title">הכנסות לפי יום</h3>
          <div className="flex items-center gap-3 text-[11px] text-muted">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-plum-700" />בוצע</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blush-300" />צפוי</span>
          </div>
        </div>
        <div className="flex h-28 items-end gap-1.5">
          {bars.map((b) => (
            <div key={b.d.toISOString()} className="group relative flex flex-1 flex-col items-center justify-end" title={`${b.d.toLocaleDateString("he-IL")} · ${ils(b.value)} · ${b.count} תורים`}>
              <div
                className={`w-full rounded-t-[4px] transition ${b.future ? "bg-blush-300" : "bg-plum-700"} ${b.isToday ? "ring-2 ring-blush-500 ring-offset-1" : ""}`}
                style={{ height: `${Math.max(b.value > 0 ? 6 : 2, (b.value / barMax) * 100)}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1.5 text-[10px] text-muted">
          {bars.map((b) => (
            <div key={b.d.toISOString()} className={`flex-1 text-center ${b.isToday ? "font-extrabold text-plum-700" : ""}`}>
              {DAY_NAMES[b.d.getDay()].slice(0, 1)}'
            </div>
          ))}
        </div>
        <div className="mt-0.5 flex justify-between text-[10px] text-muted">
          <span>{bars[0].d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })}</span>
          <span>היום</span>
          <span>{bars[13].d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })}</span>
        </div>
      </div>

      {/* היום */}
      {nextToday.length > 0 && (
        <div className="card">
          <div className="mb-2.5 flex items-center justify-between">
            <h3 className="section-title">הבאים בתור היום</h3>
            <button className="text-xs font-bold text-blush-600" onClick={goCalendar}>ליומן ›</button>
          </div>
          <div className="flex flex-col gap-2">
            {nextToday.map((a) => (
              <div key={a.id} className="flex items-center gap-3 text-sm">
                <span className="flex items-center gap-1 rounded-xl bg-blush-50 px-2 py-1 text-xs font-bold text-plum-700"><ClockIcon size={12} />{fmtTime(a.starts_at)}</span>
                <span className="min-w-0 flex-1 truncate"><b>{a.client_name}</b> · {a.services?.name}</span>
                {a.status === "pending" ? <span className="badge-wait">ממתין</span> : <span className="text-xs font-bold text-plum-500">{ils(a.est)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* טיפולים מובילים */}
      {topServices.length > 0 && (
        <div className="card">
          <h3 className="section-title mb-3">הטיפולים המבוקשים (90 יום)</h3>
          <div className="flex flex-col gap-2.5">
            {topServices.map(([name, v]) => (
              <div key={name} className="text-sm">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-semibold">{name}</span>
                  <span className="text-xs text-muted">{v.n} תורים · {ils(v.rev)}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-blush-50">
                  <div className="h-2 rounded-full bg-plum-700" style={{ width: `${(v.n / topMax) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* לקוחות לחזרה */}
      {winBack.length > 0 && (
        <div className="card">
          <h3 className="section-title">שווה לפנות אליהן</h3>
          <p className="mb-3 text-xs text-muted">ביקור אחרון לפני יותר מ-6 שבועות, ועדיין בלי תור חדש</p>
          <div className="flex flex-col gap-2">
            {winBack.map((a) => {
              const weeks = Math.round((now.getTime() - new Date(a.starts_at).getTime()) / (7 * 864e5));
              return (
                <div key={a.client_phone} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{a.client_name}</div>
                    <div className="text-xs text-muted">{a.services?.name} · לפני {weeks} שבועות</div>
                  </div>
                  <a
                    href={waLink(a.client_phone, `היי ${a.client_name.split(" ")[0]} 💅 עבר זמן מהביקור האחרון – בא לך לרענן את הציפורניים? אפשר לקבוע כאן: https://pretty-easy.vercel.app`)}
                    target="_blank" rel="noopener"
                    className="flex shrink-0 items-center gap-1 rounded-full bg-success px-3 py-1.5 text-xs font-bold text-white"
                  >
                    <WhatsAppIcon size={14} />וואטסאפ
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="pb-2 text-center text-[11px] text-muted">ההכנסות מחושבות לפי מחיר הבסיס של כל טיפול + תוספות (ללא טווח)</p>
    </section>
  );
}

function StatTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-3xl border px-3 py-3.5 ${accent ? "border-plum-700 bg-white shadow-card" : "border-line bg-white"}`}>
      <div className="text-[11px] font-semibold text-muted">{label}</div>
      <div className="mt-0.5 text-xl font-extrabold leading-tight text-plum-700">{value}</div>
      {sub && <div className="mt-1 text-[10px] leading-snug text-muted">{sub}</div>}
    </div>
  );
}

function MiniStat({ label, value, warn, onClick }: { label: string; value: string; warn?: boolean; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className={`rounded-2xl border px-2.5 py-3 text-center ${warn ? "border-[#F3DFAF] bg-[#FFF8E8]" : "border-line bg-white"}`}>
      <div className={`text-xl font-extrabold leading-none ${warn ? "text-[#8A5A12]" : "text-plum-700"}`}>{value}</div>
      <div className="mt-1 text-[10px] font-medium text-muted">{label}</div>
    </Tag>
  );
}
