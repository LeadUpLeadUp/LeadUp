# אריה לווין — דף נחיתה

דף נחיתה בעברית עם חיבור ל-CRM (Supabase `campaign_leads`).

## הפעלה מקומית

פתחו את `index.html` בדפדפן, או:

```bash
npx --yes serve .
```

## CRM

- **קמפיין:** `cmp_arie_levin_landing` / **אריה לווין**
- **RPC:** `ingest_landing_lead` (כמו `gemel-invest-landing`)
- לידים מופיעים ב-CRM תחת **לידים מקמפיין** עם תג «דף נחיתה»

## קבצים

- `index.html` — מבנה הדף
- `style.css` — עיצוב לפי המוקאפ שאושר
- `app.js` — טופס + שליחה ל-CRM
- `assets/arie-hero.svg` — תמונת גיבור זמנית

## החלפת תמונה

כרגע הדף כולל תמונת SVG זמנית כדי שהאתר יעלה בלי תמונה שבורה.
אם תרצה את התמונה המקורית, פשוט שמור אותה בתיקייה `assets` ועדכן את הנתיב ב-`index.html`.
