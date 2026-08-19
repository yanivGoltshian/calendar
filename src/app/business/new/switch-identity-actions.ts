'use server';

import { signOut } from '@/auth';

/**
 * התנתקות מהחשבון הנוכחי כדי לפתוח עסק נוסף בזהות אחרת.
 *
 * פתיחת עסק נוסף תחת אותה זהות (אותו ownerEmail) הייתה יוצרת עסק שני ומנתקת
 * את הגישה לעסק הראשון (getActiveBusiness מחזיר את החדש ביותר, ואין מחליף עסק).
 * לכן במקום ליצור עסק שני, מתנתקים ומחזירים את המשתמש למשפך הכניסה של
 * /business/new, שם הוא נכנס בחשבון Google אחר או טלפון אחר -> ownerEmail אחר,
 * והעסק הקיים נשאר שלם ונגיש.
 */
export async function switchIdentityForAnotherBusiness() {
  await signOut({ redirectTo: '/business/new' });
}
