"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

type Info = {
  service_name: string;
  starts_at: string;
  client_name: string;
  status: string;
};

export default function CancelPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<Info | null | "loading">("loading");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase
      .rpc("get_appointment_by_token", { p_token: token })
      .then(({ data }) => setInfo((data as Info) ?? null));
  }, [token]);

  async function cancel() {
    setBusy(true);
    const { data } = await supabase.rpc("cancel_appointment", { p_token: token });
    setBusy(false);
    if (data) setDone(true);
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
    <main className="mx-auto flex max-w-md flex-col items-center px-4 pt-10 text-center">
      <Image src="/logo.png" alt="Pretty Easy" width={180} height={54} className="mb-8" />

      {info === "loading" && <p className="text-plum-500">טוען…</p>}

      {info === null && (
        <div className="card w-full">
          <p>התור לא נמצא. ייתכן שהקישור שגוי.</p>
        </div>
      )}

      {info && info !== "loading" && !done && info.status !== "cancelled" && (
        <div className="card w-full">
          <h1 className="mb-2 text-xl font-bold">ביטול תור</h1>
          <p className="mb-1">{info.client_name}, התור שלך:</p>
          <p className="mb-4 font-semibold">
            {info.service_name} · {dateText}
          </p>
          <button className="btn-primary w-full !bg-red-700 hover:!bg-red-600" onClick={cancel} disabled={busy}>
            {busy ? "מבטל…" : "כן, בטלי את התור"}
          </button>
          <p className="mt-3 text-xs text-plum-500">הביטול מיידי ואי אפשר לשחזר</p>
        </div>
      )}

      {info && info !== "loading" && (done || info.status === "cancelled") && (
        <div className="card w-full">
          <h1 className="mb-2 text-xl font-bold">התור בוטל</h1>
          <p className="text-plum-500">נשמח לראות אותך בפעם אחרת 💕</p>
          <a href="/" className="btn-primary mt-4 inline-block">
            קביעת תור חדש
          </a>
        </div>
      )}
    </main>
  );
}
