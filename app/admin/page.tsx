"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import type { Session } from "@supabase/supabase-js";
import {
  supabase,
  Service,
  Appointment,
  WorkingHour,
  BlockedTime,
  Client,
} from "@/lib/supabase";
import { subscribeAdminPush, pushResultMessage } from "@/lib/push";

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const TABS = ["יומן", "טיפולים", "שעות עבודה", "חסימות", "לקוחות"] as const;
type Tab = (typeof TABS)[number];

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
    <main className="mx-auto flex max-w-sm flex-col items-center px-4 pt-16">
      <Image src="/logo.png" alt="Pretty Easy" width={200} height={60} className="mb-8" />
      <form onSubmit={signIn} className="card flex w-full flex-col gap-4">
        <h1 className="text-center text-xl font-bold">כניסת מנהלת</h1>
        <input
          className="input"
          type="email"
          placeholder="אימייל"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          dir="ltr"
        />
        <input
          className="input"
          type="password"
          placeholder="סיסמה"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          dir="ltr"
        />
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button className="btn-primary" disabled={busy}>
          {busy ? "מתחברת…" : "כניסה"}
        </button>
      </form>
    </main>
  );
}

function Dashboard() {
  const [tab, setTab] = useState<Tab>("יומן");
  const [pushMsg, setPushMsg] = useState<string | null>(null);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16">
      <header className="flex items-center justify-between py-4">
        <Image src="/logo.png" alt="Pretty Easy" width={140} height={42} />
        <div className="flex items-center gap-1">
          <button
            className="btn-ghost text-sm"
            title="קבלת התראה על כל תור חדש"
            onClick={async () => {
              const r = await subscribeAdminPush();
              setPushMsg(pushResultMessage(r));
            }}
          >
            🔔
          </button>
          <button className="btn-ghost text-sm" onClick={() => supabase.auth.signOut()}>
            יציאה
          </button>
        </div>
      </header>
      {pushMsg && (
        <p className="mb-3 rounded-xl bg-blush-100 p-2 text-center text-xs">{pushMsg}</p>
      )}

      <nav className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`chip whitespace-nowrap ${tab === t ? "chip-active" : ""}`}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === "יומן" && <CalendarTab />}
      {tab === "טיפולים" && <ServicesTab />}
      {tab === "שעות עבודה" && <HoursTab />}
      {tab === "חסימות" && <BlockedTab />}
      {tab === "לקוחות" && <ClientsTab />}
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

function CalendarTab() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [view, setView] = useState<"day" | "week">("day");
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [blocks, setBlocks] = useState<BlockedTime[]>([]);
  const [pending, setPending] = useState<Appointment[]>([]);
  const [grid, setGrid] = useState({ start: 8, end: 20 });
  const [sel, setSel] = useState<Appointment | null>(null);
  const [busy, setBusy] = useState(false);

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
    setSel(null);
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
      {/* ממתינים לאישור */}
      {pending.length > 0 && (
        <div className="mb-4 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
          <h3 className="mb-2 font-bold text-amber-900">
            ⏳ {pending.length} {pending.length === 1 ? "תור ממתין" : "תורים ממתינים"} לאישור
          </h3>
          <div className="flex flex-col gap-2">
            {pending.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-white p-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-semibold">
                    {a.client_name} · {a.services?.name}
                  </div>
                  <div className="text-xs text-plum-500">
                    יום {DAY_NAMES[new Date(a.starts_at).getDay()]}{" "}
                    {new Date(a.starts_at).toLocaleDateString("he-IL")} · {fmtTime(a.starts_at)}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    className="rounded-full bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-green-500"
                    disabled={busy}
                    onClick={() => setStatus(a.id, "confirmed")}
                  >
                    ✓ אישור
                  </button>
                  <button
                    className="btn-ghost !px-2 text-xs text-red-700"
                    disabled={busy}
                    onClick={() => setStatus(a.id, "cancelled")}
                  >
                    דחייה
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ניווט */}
      <div className="mb-2 flex items-center justify-between">
        <button className="btn-ghost !px-3" onClick={() => moveWeek(-1)}>
          ‹
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {days[0].toLocaleDateString("he-IL", { day: "numeric", month: "short" })} –{" "}
            {days[6].toLocaleDateString("he-IL", { day: "numeric", month: "short" })}
          </span>
          <button
            className="btn-ghost !py-1 text-xs"
            onClick={() => {
              const t = new Date();
              t.setHours(0, 0, 0, 0);
              setSelectedDay(t);
              setWeekStart(startOfWeek(t));
            }}
          >
            היום
          </button>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex rounded-full border border-blush-200 p-0.5 text-xs">
            <button
              className={`rounded-full px-3 py-1 ${view === "day" ? "bg-plum-700 text-white" : ""}`}
              onClick={() => setView("day")}
            >
              יום
            </button>
            <button
              className={`rounded-full px-3 py-1 ${view === "week" ? "bg-plum-700 text-white" : ""}`}
              onClick={() => setView("week")}
            >
              שבוע
            </button>
          </div>
          <button className="btn-ghost !px-3" onClick={() => moveWeek(1)}>
            ›
          </button>
        </div>
      </div>

      {/* פס ימים (בתצוגת יום) */}
      {view === "day" && (
        <div className="mb-3 grid grid-cols-7 gap-1">
          {days.map((d) => {
            const isSel = d.toDateString() === selectedDay.toDateString();
            const isToday = d.toDateString() === now.toDateString();
            const count = appts.filter(
              (a) => new Date(a.starts_at).toDateString() === d.toDateString()
            ).length;
            return (
              <button
                key={d.toISOString()}
                onClick={() => setSelectedDay(new Date(d))}
                className={`flex flex-col items-center rounded-xl py-1.5 transition ${
                  isSel ? "bg-plum-700 text-white" : isToday ? "bg-blush-100" : "bg-white"
                }`}
              >
                <span className="text-[10px]">{DAY_NAMES[d.getDay()].slice(0, 3)}'</span>
                <span className="text-base font-bold leading-tight">{d.getDate()}</span>
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    count > 0 ? (isSel ? "bg-white" : "bg-blush-400") : "bg-transparent"
                  }`}
                />
              </button>
            );
          })}
        </div>
      )}

      {/* רשת השעות */}
      <div className="card overflow-x-auto !p-0">
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

                <div className="relative" style={{ height: (grid.end - grid.start) * HOUR_PX }}>
                  {/* קווי שעה */}
                  {gridHours.map((h, i) => (
                    <div
                      key={h}
                      className="absolute inset-x-0 border-t border-blush-100/70"
                      style={{ top: i * HOUR_PX }}
                    />
                  ))}

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
                        className="absolute inset-x-0.5 z-0 rounded-lg text-center text-[10px] text-gray-500"
                        style={{
                          top,
                          height: bottom - top,
                          background:
                            "repeating-linear-gradient(45deg,#f1f1f1,#f1f1f1 6px,#e5e5e5 6px,#e5e5e5 12px)",
                        }}
                      >
                        {b.reason && <span className="leading-6">{b.reason}</span>}
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
                        onClick={() => setSel(a)}
                        className={`absolute inset-x-0.5 z-10 overflow-hidden rounded-lg px-1.5 py-0.5 text-right text-[11px] leading-tight transition active:scale-[0.98] ${
                          isPending
                            ? "border-2 border-dashed border-amber-400 bg-amber-50 text-amber-900"
                            : "bg-plum-700 text-white shadow-sm"
                        }`}
                        style={{ top, height }}
                      >
                        <div className="truncate font-bold">
                          {fmtTime(a.starts_at)} {a.client_name}
                        </div>
                        <div className="truncate opacity-80">
                          {a.services?.name}
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

      {/* פרטי תור */}
      {sel && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setSel(null)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-lg font-bold">{sel.client_name}</h3>
              {sel.status === "pending" ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                  ⏳ ממתין לאישור
                </span>
              ) : (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                  ✓ מאושר
                </span>
              )}
            </div>
            <p className="text-sm">
              {sel.services?.name} ·{" "}
              {new Date(sel.starts_at).toLocaleDateString("he-IL", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}{" "}
              · {fmtTime(sel.starts_at)}–{fmtTime(sel.ends_at)}
            </p>
            <a href={`tel:${sel.client_phone}`} className="text-sm text-blush-600" dir="ltr">
              {sel.client_phone} 📞
            </a>
            {sel.notes && <p className="mt-2 rounded-xl bg-blush-50 p-2 text-sm">📝 {sel.notes}</p>}
            <div className="mt-4 flex gap-2">
              {sel.status === "pending" && (
                <button
                  className="btn-primary flex-1 !bg-green-600 hover:!bg-green-500"
                  disabled={busy}
                  onClick={() => setStatus(sel.id, "confirmed")}
                >
                  ✓ אישור התור
                </button>
              )}
              <button
                className="btn-ghost border border-red-200 text-red-700"
                disabled={busy}
                onClick={() => setStatus(sel.id, "cancelled")}
              >
                ביטול התור
              </button>
              <button className="btn-ghost" onClick={() => setSel(null)}>
                סגירה
              </button>
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ name: "", duration: 60, price: 0 });
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
    await supabase
      .from("services")
      .insert({ name, duration_minutes: duration, price });
    setName("");
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
    setEdit({ name: s.name, duration: s.duration_minutes, price: Number(s.price) });
  }

  async function saveEdit(id: string) {
    setSaving(true);
    await supabase
      .from("services")
      .update({ name: edit.name, duration_minutes: edit.duration, price: edit.price })
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
                {s.duration_minutes} דק' · ₪{Number(s.price)}
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-1">
              <button className="btn-ghost text-sm" onClick={() => startEdit(s)}>
                עריכה ✏️
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

/* ===== שעות עבודה ===== */

type DayRow = { enabled: boolean; start: string; end: string };

function HoursTab() {
  const [rows, setRows] = useState<DayRow[]>(
    Array.from({ length: 7 }, () => ({ enabled: false, start: "09:00", end: "19:00" }))
  );
  const [saving, setSaving] = useState(false);
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
  }, []);

  async function save() {
    setSaving(true);
    await supabase.from("working_hours").delete().gte("day_of_week", 0);
    const inserts = rows
      .map((r, i) => ({ day_of_week: i, start_time: r.start, end_time: r.end, enabled: r.enabled }))
      .filter((r) => r.enabled)
      .map(({ enabled, ...rest }) => rest);
    if (inserts.length) await supabase.from("working_hours").insert(inserts);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <section className="card flex flex-col gap-3">
      <h3 className="font-bold">שעות קבלה קבועות</h3>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-3 text-sm">
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
      ))}
      <button className="btn-primary mt-2" onClick={save} disabled={saving}>
        {saving ? "שומרת…" : saved ? "נשמר ✓" : "שמירה"}
      </button>
    </section>
  );
}

/* ===== חסימות ===== */

function BlockedTab() {
  const [blocks, setBlocks] = useState<BlockedTime[]>([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");

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
    await supabase.from("blocked_times").insert({
      starts_at: new Date(start).toISOString(),
      ends_at: new Date(end).toISOString(),
      reason: reason || null,
    });
    setStart("");
    setEnd("");
    setReason("");
    load();
  }

  async function remove(id: string) {
    await supabase.from("blocked_times").delete().eq("id", id);
    load();
  }

  return (
    <section className="flex flex-col gap-4">
      <form onSubmit={add} className="card flex flex-col gap-3">
        <h3 className="font-bold">חסימת זמן (חופשה / הפסקה)</h3>
        <div>
          <label className="label">מתחילת</label>
          <input className="input" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
        </div>
        <div>
          <label className="label">עד</label>
          <input className="input" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required />
        </div>
        <input className="input" placeholder="סיבה (לא חובה)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <button className="btn-primary">חסימה</button>
      </form>

      {blocks.map((b) => (
        <div key={b.id} className="card flex items-center justify-between text-sm">
          <div>
            <div className="font-semibold">
              {new Date(b.starts_at).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })} –{" "}
              {new Date(b.ends_at).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}
            </div>
            {b.reason && <div className="text-plum-500">{b.reason}</div>}
          </div>
          <button className="btn-ghost text-xs text-red-700" onClick={() => remove(b.id)}>
            הסרה
          </button>
        </div>
      ))}
      {blocks.length === 0 && <p className="text-center text-sm text-plum-500">אין חסימות קרובות</p>}
    </section>
  );
}

/* ===== לקוחות ===== */

function ClientsTab() {
  const [clients, setClients] = useState<Client[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => setClients((data as Client[]) ?? []));
  }, []);

  const filtered = clients.filter(
    (c) => c.name.includes(q) || c.phone.includes(q)
  );

  return (
    <section className="flex flex-col gap-3">
      <input
        className="input"
        placeholder="חיפוש לפי שם או טלפון…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {filtered.map((c) => (
        <div key={c.id} className="card flex items-center justify-between text-sm">
          <div>
            <div className="font-semibold">{c.name}</div>
            <a href={`tel:${c.phone}`} className="text-blush-600" dir="ltr">
              {c.phone}
            </a>
          </div>
          <span className="text-xs text-plum-500">
            הצטרפה {new Date(c.created_at).toLocaleDateString("he-IL")}
          </span>
        </div>
      ))}
      {filtered.length === 0 && <p className="text-center text-sm text-plum-500">אין לקוחות עדיין</p>}
    </section>
  );
}
