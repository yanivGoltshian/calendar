// טיפוסים משותפים (סריאליזביליים) בין רכיב השרת (page) לרכיבי הלקוח של היומן.
// כל המיקומים מחושבים בשרת ומועברים כדקות/מחרוזות תאריך בלבד — ללא אובייקטי Date.

export type CalendarView = 'day' | 'week';

/** בלוק תור מוכן לרינדור בגריד. */
export type ApptBlock = {
  id: string;
  columnKey: string; // day: staffId · week: תאריך מקומי YYYY-MM-DD
  startMinute: number; // דקות מחצות (זמן מקומי)
  durationMin: number;
  status: string; // AppointmentStatus
  clientId: string;
  clientName: string;
  clientPhone: string; // כבר מעוצב לתצוגה
  clientEmail: string;
  serviceNames: string;
  colorIndex: number;
  priceAgorot: number;
  startLabel: string; // "HH:MM"
  endLabel: string; // "HH:MM"
};

/** עמודה ביומן: איש צוות (תצוגת יום) או יום (תצוגת שבוע). */
export type CalendarColumn = {
  key: string;
  title: string;
  subtitle: string;
  staffId: string;
  date: string; // YYYY-MM-DD
  isToday: boolean;
};

/** שירות לבחירה בטופס יצירת תור + במקרא הצבעים. */
export type ServiceOption = {
  id: string;
  name: string;
  durationMin: number;
  priceAgorot: number;
  colorIndex: number;
};

/** איש צוות לבורר תצוגת השבוע. */
export type StaffOption = {
  id: string;
  displayName: string;
  title: string;
};
