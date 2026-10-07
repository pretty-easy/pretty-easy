# Pretty Easy – מערכת קביעת תורים 💅

אתר קביעת תורים ללק ג'ל: לקוחות קובעות תור בלי התחברות, המנהלת מנהלת הכל מדף אדמין.

- **לקוחות:** `/` – בחירת טיפול → תאריך ושעה → פרטים → אישור + קישור ביטול
- **ביטול:** `/cancel/<token>`
- **אדמין:** `/admin` – יומן שבועי, טיפולים, שעות עבודה, חסימות, לקוחות

## הקמה

### 1. Supabase (ארגון נפרד, חינמי)
1. היכנסו ל-[supabase.com](https://supabase.com) → New organization (Free) → New project
2. ב-SQL Editor הריצו את `supabase/migrations/0001_init.sql`
3. Authentication → Users → Add user → צרו משתמש למנהלת (אימייל + סיסמה)
4. Settings → API → העתיקו את ה-URL ואת ה-anon key

### 2. הרצה מקומית
```bash
npm install
cp .env.example .env.local   # ומלאו את הערכים
npm run dev
```

### 3. פריסה ל-Vercel
1. דחפו את התיקייה לריפו GitHub
2. ב-[vercel.com](https://vercel.com) → New Project → ייבוא הריפו
3. ב-Environment Variables הוסיפו:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy 🚀

## אבטחה
- RLS מופעל על כל הטבלאות; לקוחות אנונימיות רואות רק טיפולים ושעות עבודה
- קביעה/ביטול תור רק דרך פונקציות SECURITY DEFINER שמאמתות זמינות
- תורים כפולים נחסמים גם ברמת ה-DB (exclusion constraint על טווח הזמן)
- שעון: Asia/Jerusalem (מוגדר בפונקציית המשבצות)
