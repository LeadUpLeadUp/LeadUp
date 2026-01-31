LEADUP • חיבור Google Sheets (מתוקן)

1) Google Sheets:
   Extensions → Apps Script → הדבק AppsScript_Code.gs
   Deploy → New deployment → Web app
   Execute as: Me
   Who has access: Anyone with the link
   העתק את כתובת ה-/exec

2) במערכת (הגדרות → Google Sheets):
   הדבק URL
   לחץ 'בדוק חיבור' (אמור להחזיר pong)
   מצב: Sheets
   אם השיט ריק: 'שמור לשיט'
   אם יש נתונים בשיט: 'טען מהשיט'

העדכון הזה עושה 'טען מהשיט' סלחני (גם אם חסרים events/tasks) ומונע בעיות CORS-preflight ב'שמור לשיט'.
