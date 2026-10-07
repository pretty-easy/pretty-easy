import { createClient } from "@supabase/supabase-js";

// הערכים האמיתיים מגיעים ממשתני הסביבה (ב-Vercel או ב-.env.local).
// ה-fallback קיים רק כדי שה-build לא ייכשל לפני שהוגדרו.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

export const supabase = createClient(url, anonKey);

export type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  price_max: number | null;
  is_active: boolean;
};

export type Addon = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  price_max: number | null;
  is_active: boolean;
};

export type ApptAddon = {
  id: string;
  name: string;
  price: number;
  price_max: number | null;
  duration_minutes: number;
};

// 45 → "45 דק'" · 60 → "שעה" · 75 → "שעה ו-15 דק'" · 90 → "שעה וחצי" · 120 → "שעתיים"
export function durationLabel(min: number) {
  const m = Math.round(Number(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} דק'`;
  const hours = h === 1 ? "שעה" : h === 2 ? "שעתיים" : `${h} שעות`;
  if (r === 0) return hours;
  if (r === 30) return `${hours} וחצי`;
  return `${hours} ו-${r} דק'`;
}

// קישור וואטסאפ: 050-1234567 → https://wa.me/972501234567
export function waLink(phone: string, text?: string) {
  const digits = phone.replace(/\D/g, "");
  const intl = digits.startsWith("0") ? "972" + digits.slice(1) : digits;
  return `https://wa.me/${intl}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

// "₪120" או "₪120–180"
export function priceLabel(min: number, max?: number | null) {
  const lo = Number(min);
  const hi = max == null ? null : Number(max);
  return hi != null && hi > lo ? `₪${lo}–${hi}` : `₪${lo}`;
}

export type Slot = {
  slot_start: string; // timestamptz ISO
  label: string; // "09:30"
};

export type Appointment = {
  id: string;
  service_id: string;
  starts_at: string;
  ends_at: string;
  client_name: string;
  client_phone: string;
  notes: string | null;
  status: "pending" | "confirmed" | "cancelled";
  cancel_token?: string;
  addons?: ApptAddon[];
  services?: { name: string } | null;
};

export type WorkingHour = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

export type BlockedTime = {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
};

export type Client = {
  id: string;
  name: string;
  phone: string;
  notes: string | null;
  created_at: string;
};
