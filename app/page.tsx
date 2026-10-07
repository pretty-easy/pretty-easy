"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { supabase, Service, Slot } from "@/lib/supabase";

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function toDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function BookingPage() {
  const [step, setStep] = useState(1);
  const [services, setServices] = useState<Service[]>([]);
  const [service, setService] = useState<Service | null>(null);
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
      if (d.getDay() === 6) continue; // שבת
      out.push({ date: d, str: toDateStr(d) });
    }
    return out;
  }, []);

  useEffect(() => {
    supabase
      .from("services")
      .select("*")
      .order("price", { ascending: false })
      .then(({ data }) => setServices((data as Service[]) ?? []));
  }, []);

  useEffect(() => {
    if (!service || !dateStr) return;
    setSlotsLoading(true);
    setSlot(null);
    supabase
      .rpc("get_available_slots", { p_service_id: service.id, p_date: dateStr })
      .then(({ data }) => {
        setSlots((data as Slot[]) ?? []);
        setSlotsLoading(false);
      });
  }, [service, dateStr]);

  async function book() {
    if (!service || !slot) return;
    setSubmitting(true);
    setError(null);
    const { data, error } = await supabase.rpc("book_appointment", {
      p_service_id: service.id,
      p_slot_start: slot.slot_start,
      p_name: name,
      p_phone: phone,
      p_notes: notes,
    });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      // אם המשבצת נתפסה – רענון המשבצות
      if (error.message.includes("פנוי")) {
        const { data: fresh } = await supabase.rpc("get_available_slots", {
          p_service_id: service.id,
          p_date: dateStr,
        });
        setSlots((fresh as Slot[]) ?? []);
        setSlot(null);
        setStep(2);
      }
      return;
    }
    setCancelToken((data as { cancel_token: string }).cancel_token);
    setStep(4);
  }

  const selectedDay = days.find((d) => d.str === dateStr);

  return (
    <main className="mx-auto max-w-md px-4 pb-16">
      <header className="flex flex-col items-center pt-8 pb-6">
        <Image src="/logo.png" alt="Pretty Easy" width={220} height={66} priority />
      </header>

      {step < 4 && (
        <div className="mb-6 flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all ${
                s === step ? "w-8 bg-plum-700" : s < step ? "w-2 bg-blush-400" : "w-2 bg-blush-200"
              }`}
            />
          ))}
        </div>
      )}

      {step === 1 && (
        <section>
          <h1 className="mb-4 text-xl font-bold">איזה טיפול בא לך? 💅</h1>
          <div className="flex flex-col gap-3">
            {services.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setService(s);
                  setStep(2);
                }}
                className="card flex items-center justify-between text-right transition hover:ring-2 hover:ring-blush-300"
              >
                <div>
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-sm text-plum-500">{s.duration_minutes} דקות</div>
                </div>
                <div className="text-lg font-bold text-blush-600">₪{Number(s.price)}</div>
              </button>
            ))}
            {services.length === 0 && (
              <p className="text-center text-plum-500">טוען טיפולים…</p>
            )}
          </div>
        </section>
      )}

      {step === 2 && service && (
        <section>
          <button className="btn-ghost mb-2 text-sm" onClick={() => setStep(1)}>
            → חזרה לטיפולים
          </button>
          <h1 className="mb-1 text-xl font-bold">מתי נוח לך?</h1>
          <p className="mb-4 text-sm text-plum-500">
            {service.name} · {service.duration_minutes} דק' · ₪{Number(service.price)}
          </p>

          <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-2">
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
                <span className="text-xs">{DAY_NAMES[d.date.getDay()]}</span>
                <span className="text-lg font-bold">{d.date.getDate()}</span>
                <span className="text-xs">
                  {d.date.toLocaleDateString("he-IL", { month: "short" })}
                </span>
              </button>
            ))}
          </div>

          {dateStr && (
            <>
              <h2 className="mb-3 font-semibold">שעות פנויות</h2>
              {slotsLoading ? (
                <p className="text-plum-500">בודק זמינות…</p>
              ) : slots.length === 0 ? (
                <p className="rounded-xl bg-blush-100 p-4 text-sm">
                  אין שעות פנויות ביום זה 😕 נסי יום אחר
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {slots.map((sl) => (
                    <button
                      key={sl.slot_start}
                      onClick={() => setSlot(sl)}
                      className={`chip ${slot?.slot_start === sl.slot_start ? "chip-active" : ""}`}
                    >
                      {sl.label}
                    </button>
                  ))}
                </div>
              )}
              <button
                className="btn-primary mt-6 w-full"
                disabled={!slot}
                onClick={() => setStep(3)}
              >
                המשך
              </button>
            </>
          )}
        </section>
      )}

      {step === 3 && service && slot && selectedDay && (
        <section>
          <button className="btn-ghost mb-2 text-sm" onClick={() => setStep(2)}>
            → חזרה לבחירת מועד
          </button>
          <h1 className="mb-4 text-xl font-bold">כמעט סיימנו ✨</h1>

          <div className="card mb-5 text-sm">
            <div className="font-semibold">{service.name}</div>
            <div className="text-plum-500">
              יום {DAY_NAMES[selectedDay.date.getDay()]},{" "}
              {selectedDay.date.toLocaleDateString("he-IL")} בשעה {slot.label}
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
                placeholder="השם שלך"
              />
            </div>
            <div>
              <label className="label">טלפון</label>
              <input
                className="input"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
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
              {submitting ? "קובעת תור…" : "אישור וקביעת תור"}
            </button>
          </form>
        </section>
      )}

      {step === 4 && service && slot && selectedDay && (
        <section className="flex flex-col items-center pt-8 text-center">
          <div className="animate-pop mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-blush-400 text-4xl text-white">
            ✓
          </div>
          <h1 className="mb-2 text-2xl font-bold">התור נקבע! 🎉</h1>
          <p className="mb-6 text-plum-500">
            {service.name} · יום {DAY_NAMES[selectedDay.date.getDay()]}{" "}
            {selectedDay.date.toLocaleDateString("he-IL")} בשעה {slot.label}
          </p>
          <div className="card w-full text-sm">
            <p className="mb-2">צריך לבטל? אפשר דרך הקישור:</p>
            <a
              href={`/cancel/${cancelToken}`}
              className="break-all font-medium text-blush-600 underline"
            >
              ביטול התור
            </a>
            <p className="mt-3 text-xs text-plum-500">
              שמרי את הקישור – הוא הדרך לבטל בלי להתקשר
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
