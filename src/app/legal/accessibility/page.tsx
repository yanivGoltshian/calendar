import { BRAND } from '@/config/brand';
import { buildMetadata } from '@/lib/seo';
import { LEGAL_ACCESSIBILITY } from '@/content/legal/meta';

import { LegalArticle } from '../_components/legal-shell';
import { LegalSection, LegalText, LegalList, LegalItem } from '../_components/prose';

export const dynamic = 'force-static';

export const metadata = buildMetadata({
  title: 'הצהרת נגישות',
  description:
    'הצהרת הנגישות של השירות: מחויבותנו לנגישות דיגיטלית לפי תקנות שוויון זכויות לאנשים עם מוגבלות והתקן הישראלי ת״י 5568, האמצעים שיושמו ודרכי הפנייה לרכז הנגישות.',
  path: '/legal/accessibility',
});

export default function AccessibilityPage() {
  return (
    <LegalArticle
      title="הצהרת נגישות"
      path="/legal/accessibility"
      lead={`ב${BRAND.name} אנו רואים בהנגשת השירות ערך ומחויבות. אנו פועלים כדי לאפשר לכלל המשתמשים, לרבות אנשים עם מוגבלות, לעשות שימוש נוח ועצמאי בשירות.`}
    >
      <LegalSection id="commitment" title="1. מחויבות לנגישות">
        <LegalText>
          {BRAND.name} מחויבת להנגשת השירות הדיגיטלי שלה לכלל הציבור, ובכלל זה אנשים עם מוגבלות, מתוך
          תפיסה של שוויון הזדמנויות ומתן שירות מכובד, נגיש ועצמאי. אנו פועלים להנגשת האתר והשירות ברוח
          חוק שוויון זכויות לאנשים עם מוגבלות, התשנ״ח-1998, ותקנות שוויון זכויות לאנשים עם מוגבלות
          (התאמות נגישות לשירות), התשע״ג-2013.
        </LegalText>
      </LegalSection>

      <LegalSection id="standard" title="2. רמת הנגישות והתקן">
        <LegalText>
          הנגשת השירות נעשית בהתאם לתקן הישראלי ת״י 5568 בדבר נגישות תכנים באינטרנט, המבוסס על הנחיות
          WCAG 2.0 של ארגון W3C, ברמת התאמה AA. אנו שואפים לעמוד בהוראות אלה ולשפר באופן מתמיד את רמת
          הנגישות של השירות.
        </LegalText>
      </LegalSection>

      <LegalSection id="measures" title="3. אמצעים שיושמו">
        <LegalText>בין האמצעים שיושמו לצורך הנגשת השירות:</LegalText>
        <LegalList>
          <LegalItem>מבנה סמנטי תקין של הכותרות והתכנים לתמיכה בקוראי מסך;</LegalItem>
          <LegalItem>תמיכה בניווט באמצעות מקלדת ובסדר טאב הגיוני;</LegalItem>
          <LegalItem>שמירה על ניגודיות צבעים נאותה בין טקסט לרקע;</LegalItem>
          <LegalItem>טקסט חלופי לתמונות ולרכיבים גרפיים בעלי משמעות;</LegalItem>
          <LegalItem>תמיכה בכיווניות מימין לשמאל (RTL) ובשפה העברית;</LegalItem>
          <LegalItem>עיצוב מותאם למגוון גדלי מסך ולתצוגה במכשירים ניידים;</LegalItem>
          <LegalItem>שימוש בטקסט הניתן להגדלה מבלי לאבד תוכן או פונקציונליות.</LegalItem>
        </LegalList>
      </LegalSection>

      <LegalSection id="limitations" title="4. סייגים והתאמות בתהליך">
        <LegalText>
          למרות מאמצינו להנגיש את כלל רכיבי השירות, ייתכן כי יימצאו חלקים או תכנים שטרם הונגשו במלואם,
          לרבות רכיבים של צדדים שלישיים שאינם בשליטתנו המלאה. אנו ממשיכים לפעול לשיפור הנגישות ולתיקון
          ליקויים המובאים לידיעתנו.
        </LegalText>
        <LegalText>
          אם נתקלתם ברכיב או בתוכן שאינו נגיש, נשמח שתפנו אלינו. פנייתכם תסייע לנו לשפר את השירות עבור
          כלל המשתמשים.
        </LegalText>
      </LegalSection>

      <LegalSection id="coordinator" title="5. רכז או רכזת הנגישות">
        <LegalText>
          לפניות בנושאי נגישות, לרבות דיווח על תקלה או בקשה לקבלת סיוע, ניתן לפנות לרכז או רכזת הנגישות:
        </LegalText>
        <LegalList>
          <LegalItem>שם: {LEGAL_ACCESSIBILITY.coordinatorName}</LegalItem>
          <LegalItem>דוא״ל: {LEGAL_ACCESSIBILITY.coordinatorEmail}</LegalItem>
          <LegalItem>טלפון: {LEGAL_ACCESSIBILITY.coordinatorPhone}</LegalItem>
          <LegalItem>כתובת: {LEGAL_ACCESSIBILITY.coordinatorAddress}</LegalItem>
        </LegalList>
      </LegalSection>

      <LegalSection id="response" title="6. טיפול בפניות נגישות">
        <LegalText>
          אנו מתייחסים לפניות בנושא נגישות ברצינות ונשתדל לטפל בהן בתוך פרק זמן סביר. בעת הפנייה נבקש
          שתתארו את הבעיה, את העמוד או הרכיב שבו נתקלתם, ואת אופן הגלישה שלכם (סוג המכשיר, הדפדפן וטכנולוגיה
          מסייעת ככל שנעשה בה שימוש), כדי שנוכל לסייע ביעילות.
        </LegalText>
      </LegalSection>

      <LegalSection id="statement-date" title="7. מועד עדכון ההצהרה">
        <LegalText>
          הצהרת נגישות זו עודכנה לאחרונה בתאריך{' '}
          <time dateTime={LEGAL_ACCESSIBILITY.statementUpdatedIso} className="font-medium">
            {LEGAL_ACCESSIBILITY.statementUpdatedLabel}
          </time>
          . אנו בוחנים את ההצהרה מעת לעת ומעדכנים אותה בהתאם לשיפורי הנגישות המתבצעים בשירות.
        </LegalText>
      </LegalSection>
    </LegalArticle>
  );
}
