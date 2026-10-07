import { supabase } from "./supabase";

// מפתח VAPID ציבורי – בטוח לחשיפה בקוד הלקוח
export const VAPID_PUBLIC_KEY =
  "BDn4GczGZnb99PzFg9jKKsg7Km66f362pP9dUMUu7CmZJ0Op9HM8mCaB8qmvSwdPu7OaF3RfA6WK0WZEAdUCZGE";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export type PushResult = "granted" | "denied" | "unsupported" | "error";

async function getSubscription(): Promise<PushSubscription | "unsupported" | "denied" | null> {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return "unsupported";
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
}

// לקוחה: נרשמת לתזכורות דרך טוקן התור שלה
export async function subscribeClientPush(cancelToken: string): Promise<PushResult> {
  try {
    const sub = await getSubscription();
    if (sub === "unsupported" || sub === "denied") return sub;
    if (!sub) return "error";
    const { data, error } = await supabase.rpc("save_push_subscription", {
      p_token: cancelToken,
      p_subscription: sub.toJSON(),
    });
    return error || !data ? "error" : "granted";
  } catch {
    return "error";
  }
}

// אדמין: שמירה ישירה (מחוברת)
export async function subscribeAdminPush(): Promise<PushResult> {
  try {
    const sub = await getSubscription();
    if (sub === "unsupported" || sub === "denied") return sub;
    if (!sub) return "error";
    const json = sub.toJSON();
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        { endpoint: json.endpoint!, subscription: json, is_admin: true },
        { onConflict: "endpoint" }
      );
    return error ? "error" : "granted";
  } catch {
    return "error";
  }
}

export function pushResultMessage(r: PushResult): string {
  switch (r) {
    case "granted":
      return "ההתראות הופעלו ✓";
    case "denied":
      return "ההרשאה נדחתה – אפשר להפעיל בהגדרות הדפדפן";
    case "unsupported":
      return "באייפון: קודם שמרי את האתר למסך הבית (שיתוף ← הוספה למסך הבית), פתחי משם ונסי שוב";
    default:
      return "משהו השתבש, נסי שוב";
  }
}
