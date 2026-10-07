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

/* ===== יומן ===== */

function CalendarTab() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [appts, setAppts] = useState<Appointment[]>([]);

  const load = useCallback(async () => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 7);
    const { data } = await supabase
      .from("appointments")
      .select("*, services(name)")
      .gte("starts_at", weekStart.toISOString())
      .lt("starts_at", end.toISOString())
      .order("starts_at");
    setAppts((data as Appointment[]) ?? []);
  }, [weekStart]);

  useEffect(() => {
    load();
  }, [load]);

  async function cancelAppt(id: string) {
    if (!confirm("לבטל את התור?")) return;
    await supabase.from("appointments").update({ status: "cancelled" }).eq("id", id);
    load();
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <button
          className="btn-ghost"
          onClick={() => setWeekStart((w) => new Date(w.getTime() - 7 * 864e5))}
        >
          ‹ שבוע קודם
        </button>
        <span className="text-sm font-medium">
          {weekStart.toLocaleDateString("he-IL")} –{" "}
          {days[6].toLocaleDateString("he-IL")}
        </span>
        <button
          className="btn-ghost"
          onClick={() => setWeekStart((w) => new Date(w.getTime() + 7 * 864e5))}
        >
          שבוע הבא ›
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {days.map((d) => {
          const dayAppts = appts.filter(
            (a) => new Date(a.starts_at).toDateString() === d.toDateString()
          );
          const isToday = d.toDateString() === new Date().toDateString();
          return (
            <div key={d.toISOString()} className="card">
              <h3 className={`mb-2 font-bold ${isToday ? "text-blush-600" : ""}`}>
                יום {DAY_NAMES[d.getDay()]} · {d.toLocaleDateString("he-IL")}
                {isToday && " (היום)"}
              </h3>
              {dayAppts.length === 0 ? (
                <p className="text-sm text-plum-500">אין תורים</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {dayAppts.map((a) => (
                    <li
                      key={a.id}
                      className={`flex items-center justify-between rounded-xl p-3 text-sm ${
                        a.status === "cancelled"
                          ? "bg-gray-100 text-gray-400 line-through"
                          : "bg-blush-50"
                      }`}
                    >
                      <div>
                        <span className="font-bold">
                          {new Date(a.starts_at).toLocaleTimeString("he-IL", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>{" "}
                        · {a.services?.name} · {a.client_name}
                        <a
                          href={`tel:${a.client_phone}`}
                          className="mr-2 text-blush-600 no-underline"
                          dir="ltr"
                        >
                          {a.client_phone}
                        </a>
                        {a.notes && <div className="text-xs text-plum-500">📝 {a.notes}</div>}
                      </div>
                      {a.status !== "cancelled" && (
                        <button
                          className="btn-ghost text-xs text-red-700"
                          onClick={() => cancelAppt(a.id)}
                        >
                          ביטול
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
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
