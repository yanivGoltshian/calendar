import { BRAND } from '@/config/brand';
import { buildMetadata } from '@/lib/seo';
import { LEGAL_COMPANY } from '@/content/legal/meta';

import { LegalArticle } from '../_components/legal-shell';
import { LegalSection, LegalText, LegalList, LegalItem } from '../_components/prose';

export const dynamic = 'force-static';

export const metadata = buildMetadata({
  title: 'מדיניות פרטיות',
  description:
    'מדיניות הפרטיות של השירות: איזה מידע נאסף, כיצד אנו משתמשים בו, מסירה לצדדים שלישיים, עוגיות, אבטחת מידע, תקופות שמירה וזכויותיכם לפי חוק הגנת הפרטיות.',
  path: '/legal/privacy',
});

export default function PrivacyPage() {
  return (
    <LegalArticle
      title="מדיניות פרטיות"
      path="/legal/privacy"
      lead={`הפרטיות שלכם חשובה ל${BRAND.name}. מדיניות זו מסבירה איזה מידע אנו אוספים במסגרת השירות, כיצד אנו עושים בו שימוש, עם מי אנו חולקים אותו ומהן זכויותיכם.`}
    >
      <LegalSection id="intro" title="1. מבוא">
        <LegalText>
          מדיניות פרטיות זו חלה על השימוש בפלטפורמת {BRAND.name} (להלן: &rdquo;השירות&rdquo;) ומהווה
          חלק בלתי נפרד מתנאי השימוש. היא מתייחסת לאיסוף מידע ולעיבודו בהתאם לחוק הגנת הפרטיות,
          התשמ״א-1981 והתקנות מכוחו.
        </LegalText>
        <LegalText>
          השימוש בשירות ומסירת מידע במסגרתו מהווים הסכמה לאיסוף ולשימוש במידע כמתואר במדיניות זו.
        </LegalText>
      </LegalSection>

      <LegalSection id="controller" title="2. בעל מאגר המידע">
        <LegalText>
          בעל מאגר המידע והאחראי לעיבודו הוא {LEGAL_COMPANY.legalName}, ח״פ{' '}
          {LEGAL_COMPANY.registrationNumber}, מכתובת {LEGAL_COMPANY.address}. לפניות בנושאי פרטיות ניתן
          ליצור קשר בדוא״ל {LEGAL_COMPANY.contactEmail}.
        </LegalText>
      </LegalSection>

      <LegalSection id="collected" title="3. איזה מידע נאסף">
        <LegalText>אנו אוספים סוגי מידע אחדים לצורך אספקת השירות ושיפורו:</LegalText>
        <LegalList>
          <LegalItem>
            <strong>מידע שאתם מוסרים:</strong> פרטי הרשמה כגון שם, כתובת דוא״ל, מספר טלפון ופרטי העסק,
            וכן מידע שאתם מזינים בעת ניהול היומן וקביעת התורים.
          </LegalItem>
          <LegalItem>
            <strong>מידע על לקוחות קצה:</strong> פרטים הנמסרים בעת קביעת תור, כגון שם ומספר טלפון,
            המעובדים עבור בעל העסק לצורך ניהול התור והתזכורות.
          </LegalItem>
          <LegalItem>
            <strong>מידע טכני ושימושי:</strong> נתונים הנאספים אוטומטית כגון כתובת IP, סוג הדפדפן,
            מזהי מכשיר ונתוני שימוש בשירות, לצורך תפעול, אבטחה ושיפור.
          </LegalItem>
          <LegalItem>
            <strong>מידע מתשלומים:</strong> ככל שמתבצע תשלום, פרטי החיוב עשויים להיות מעובדים באמצעות
            ספק סליקה חיצוני; איננו שומרים פרטי אמצעי תשלום מלאים בשרתינו.
          </LegalItem>
        </LegalList>
      </LegalSection>

      <LegalSection id="purposes" title="4. מטרות השימוש במידע">
        <LegalText>המידע משמש אותנו למטרות הבאות:</LegalText>
        <LegalList>
          <LegalItem>אספקת השירות, תפעולו וניהול חשבון המשתמש;</LegalItem>
          <LegalItem>ניהול יומן התורים, קביעת תורים ושליחת תזכורות ועדכונים;</LegalItem>
          <LegalItem>מתן תמיכה, מענה לפניות וטיפול בתקלות;</LegalItem>
          <LegalItem>שיפור השירות, ניתוח שימוש ופיתוח יכולות חדשות;</LegalItem>
          <LegalItem>שמירה על אבטחת המידע ומניעת שימוש לרעה או הונאה;</LegalItem>
          <LegalItem>עמידה בדרישות הדין ובהליכים משפטיים;</LegalItem>
          <LegalItem>דיוור ושיווק, בכפוף להסכמתכם ולזכות להסיר את הסכמתכם בכל עת.</LegalItem>
        </LegalList>
      </LegalSection>

      <LegalSection id="legal-basis" title="5. בסיס חוקי והסכמה">
        <LegalText>
          עיבוד המידע נשען על הסכמתכם, על הצורך בביצוע ההתקשרות לאספקת השירות, על אינטרסים לגיטימיים
          של החברה כגון אבטחה ושיפור השירות, ועל חובות המוטלות עלינו על פי דין. מסירת המידע תלויה
          ברצונכם, אך ללא מידע מסוים לא נוכל לספק חלק מרכיבי השירות.
        </LegalText>
      </LegalSection>

      <LegalSection id="sharing" title="6. מסירת מידע לצדדים שלישיים">
        <LegalText>איננו מוכרים מידע אישי. אנו עשויים לחלוק מידע במקרים הבאים:</LegalText>
        <LegalList>
          <LegalItem>
            <strong>בין בעל עסק ללקוח קצה:</strong> פרטי זימון התור נגישים לבעל העסק שאצלו נקבע התור,
            לצורך אספקת השירות.
          </LegalItem>
          <LegalItem>
            <strong>ספקי שירות:</strong> נותני שירות מטעמנו, כגון אחסון ענן, סליקת תשלומים, שליחת
            הודעות וניתוח נתונים, המעבדים מידע עבורנו ובכפוף להתחייבויות סודיות ואבטחה.
          </LegalItem>
          <LegalItem>
            <strong>דרישות דין:</strong> ככל שנידרש לכך על פי דין, צו שיפוטי או לצורך הגנה על זכויות,
            רכוש או בטיחות.
          </LegalItem>
          <LegalItem>
            <strong>העברת פעילות:</strong> במסגרת מיזוג, רכישה או העברת נכסים, בכפוף להמשך תחולת
            מדיניות זו.
          </LegalItem>
        </LegalList>
      </LegalSection>

      <LegalSection id="cookies" title="7. עוגיות וטכנולוגיות מעקב">
        <LegalText>
          השירות עושה שימוש בעוגיות (Cookies) ובטכנולוגיות דומות לצורך תפעול תקין, שמירת העדפות, אבטחה
          וניתוח שימוש. ניתן לנהל או לחסום עוגיות דרך הגדרות הדפדפן, אך חסימה עלולה לפגוע בחלק
          מפונקציות השירות.
        </LegalText>
      </LegalSection>

      <LegalSection id="security" title="8. אבטחת מידע">
        <LegalText>
          אנו נוקטים אמצעים ארגוניים וטכנולוגיים סבירים להגנה על המידע מפני גישה, שימוש או גילוי בלתי
          מורשים, לרבות הצפנה ובקרות גישה. עם זאת, אף מערכת אינה חסינה לחלוטין, ואיננו יכולים להבטיח
          אבטחה מוחלטת.
        </LegalText>
      </LegalSection>

      <LegalSection id="retention" title="9. תקופת שמירת המידע">
        <LegalText>
          נשמור את המידע למשך הזמן הדרוש להגשמת המטרות שלשמן נאסף, לרבות עמידה בדרישות חוקיות, חשבונאיות
          או דיווחיות, וכן לצורך יישוב מחלוקות ואכיפת התחייבויות. בתום התקופה יימחק המידע או יהפוך
          לאנונימי.
        </LegalText>
      </LegalSection>

      <LegalSection id="rights" title="10. זכויות עיון, תיקון ומחיקה">
        <LegalText>
          בהתאם לחוק הגנת הפרטיות, עומדת לכם הזכות לעיין במידע המוחזק אודותיכם, לבקש את תיקונו אם אינו
          נכון, שלם או מעודכן, ולבקש את מחיקתו בכפוף לחריגים שבדין. כן ניתן לבקש את הפסקת השימוש במידע
          לצרכי דיוור.
        </LegalText>
        <LegalText>
          למימוש הזכויות ניתן לפנות אלינו בדוא״ל {LEGAL_COMPANY.contactEmail}. אנו נטפל בפנייתכם בתוך
          פרק זמן סביר ובהתאם לדין.
        </LegalText>
      </LegalSection>

      <LegalSection id="marketing" title="11. דיוור ושיווק">
        <LegalText>
          ככל שנשלח אליכם דברי פרסומת, הדבר ייעשה בהתאם להוראות סעיף 30א לחוק התקשורת (בזק ושידורים),
          התשמ״ב-1982. תוכלו להסיר את הסכמתכם ולחדול מקבלת דיוור בכל עת, באמצעות מנגנון ההסרה שבהודעה
          או בפנייה אלינו.
        </LegalText>
      </LegalSection>

      <LegalSection id="transfer" title="12. העברת מידע אל מחוץ לישראל">
        <LegalText>
          חלק מספקי השירות שלנו עשויים לאחסן או לעבד מידע מחוץ לישראל. במקרים אלה נפעל להבטיח כי ההעברה
          תתבצע בהתאם לדרישות הדין החל על הגנת הפרטיות ותוך שמירה על רמת הגנה הולמת.
        </LegalText>
      </LegalSection>

      <LegalSection id="minors" title="13. פרטיות קטינים">
        <LegalText>
          השירות אינו מיועד לשימוש עצמאי של קטינים מתחת לגיל 18 ללא הסכמת אפוטרופוס. אם נודע לנו כי
          נאסף מידע מקטין ללא הסכמה כאמור, נפעל למחיקתו.
        </LegalText>
      </LegalSection>

      <LegalSection id="changes" title="14. שינויים במדיניות">
        <LegalText>
          אנו רשאים לעדכן מדיניות זו מעת לעת. נוסח מעודכן יפורסם בעמוד זה עם עדכון תאריך &rdquo;עודכן
          לאחרונה&rdquo;. שינוי מהותי יובא לידיעתכם באמצעים סבירים. המשך השימוש בשירות מהווה הסכמה
          למדיניות המעודכנת.
        </LegalText>
      </LegalSection>

      <LegalSection id="contact" title="15. יצירת קשר">
        <LegalText>בכל שאלה או בקשה בנוגע לפרטיות ולמידע המוחזק אודותיכם, ניתן לפנות אלינו:</LegalText>
        <LegalList>
          <LegalItem>שם בעל המאגר: {LEGAL_COMPANY.legalName}</LegalItem>
          <LegalItem>דוא״ל: {LEGAL_COMPANY.contactEmail}</LegalItem>
          <LegalItem>טלפון: {LEGAL_COMPANY.contactPhone}</LegalItem>
          <LegalItem>כתובת: {LEGAL_COMPANY.address}</LegalItem>
        </LegalList>
      </LegalSection>
    </LegalArticle>
  );
}
