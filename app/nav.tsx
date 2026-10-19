"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, CalendarIcon, UserIcon } from "@/lib/icons";

// ניווט תחתון לאפליקציית הלקוחות
export default function BottomNav({ active }: { active?: "home" | "book" | "my" }) {
  const pathname = usePathname();
  const cur =
    active ?? (pathname === "/my" ? "my" : pathname === "/book" ? "book" : "home");

  const items = [
    { key: "home", href: "/", label: "בית", Icon: HomeIcon },
    { key: "book", href: "/?book=1", label: "קביעת תור", Icon: CalendarIcon },
    { key: "my", href: "/my", label: "האזור שלי", Icon: UserIcon },
  ] as const;

  return (
    <nav className="bottom-nav">
      {items.map(({ key, href, label, Icon }) => {
        const on = cur === key;
        return (
          <Link
            key={key}
            href={href}
            aria-label={label}
            className={`flex min-w-[72px] flex-col items-center gap-1 text-[11px] ${
              on ? "font-bold text-plum-700" : "font-semibold text-muted"
            }`}
          >
            <span
              className={`flex h-8 w-11 items-center justify-center rounded-full transition ${
                on ? "bg-blush-100" : ""
              }`}
            >
              <Icon size={20} strokeWidth={on ? 2.2 : 2} />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
