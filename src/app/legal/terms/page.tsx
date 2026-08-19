import { BRAND } from '@/config/brand';
import { buildMetadata } from '@/lib/seo';
import { LEGAL_COMPANY } from '@/content/legal/meta';

import { LegalArticle } from '../_components/legal-shell';
import { LegalSection, LegalText, LegalList, LegalItem, LegalSubheading } from '../_components/prose';

export const dynamic = 'force-static';

export const metadata = buildMetadata({
  title: 'תקנון ותנאי שימוש',
  description:
    'תקנון ותנאי השימוש בשירות: הכללים לשימוש בפלטפורמת זימון התורים, זכויות וחובות המשתמשים, ביטולים, תשלומים, אחריות ודין חל.',
  path: '/legal/terms',
});

export default function TermsPage() {
  const contactDetails = [
    { label: 'שם', value: LEGAL_COMPANY.legalName },
    { label: 'דוא״ל', value: LEGAL_COMPANY.contactEmail },
    { label: 'טלפון', value: LEGAL_COMPANY.contactPhone },
    { label: 'כתובת', value: LEGAL_COMPANY.address },
  ].filter((detail) => detail.value.trim().length > 0);

  return (
    <LegalArticle
      title="תקנון ותנאי שימוש"
      path="/legal/terms"
      lead={`ברוכים הבאים ל${BRAND.name}. תנאי שימוש אלה מסדירים את השימוש שלכם בפלטפורמה ובשירותים הנלווים לה. עצם השימוש בשירות מהווה הסכמה לתנאים המפורטים להלן.`}
    >
      <LegalSection id="general" title="1. כללי">
        <LegalText>
          תנאי שימוש אלה (להלן: &rdquo;התנאים&rdquo; או &rdquo;התקנון&rdquo;) מהווים הסכם משפטי מחייב בינכם
          (להלן: &rdquo;המשתמש&rdquo; או &rdquo;אתם&rdquo;) לבין {LEGAL_COMPANY.legalName}
          {LEGAL_COMPANY.registrationNumber ? <>, ח״פ {LEGAL_COMPANY.registrationNumber}</> : null} (להלן:
          &rdquo;החברה&rdquo;, &rdquo;אנחנו&rdquo; או &rdquo;{BRAND.name}&rdquo;), המפעילה את פלטפורמת זימון
          התורים וניהול העסק (להלן: &rdquo;השירות&rdquo; או &rdquo;הפלטפורמה&rdquo;).
        </LegalText>
        <LegalText>
          יש לקרוא את התנאים בעיון לפני השימוש בשירות. אם אינכם מסכימים לתנאי כלשהו מתנאים אלה, אינכם
          רשאים לעשות שימוש בשירות. התנאים מנוסחים בלשון זכר מטעמי נוחות בלבד ומופנים לכל המגדרים כאחד.
        </LegalText>
        <LegalText>
          כותרות הסעיפים נועדו לנוחות ההתמצאות בלבד ואין לפרש לפיהן את התנאים.
        </LegalText>
      </LegalSection>

      <LegalSection id="definitions" title="2. הגדרות">
        <LegalList>
          <LegalItem>
            <strong>&rdquo;השירות&rdquo;</strong> — פלטפורמת {BRAND.name} לזימון תורים, ניהול יומן,
            שליחת תזכורות וניהול לקוחות, על כל רכיביה, ממשקיה ותכניה.
          </LegalItem>
          <LegalItem>
            <strong>&rdquo;בעל עסק&rdquo;</strong> — משתמש הנרשם לשירות לצורך ניהול עסקו וקבלת זימוני
            תורים מלקוחותיו.
          </LegalItem>
          <LegalItem>
            <strong>&rdquo;לקוח קצה&rdquo;</strong> — אדם הקובע תור אצל בעל עסק באמצעות עמוד העסק
            בפלטפורמה.
          </LegalItem>
          <LegalItem>
            <strong>&rdquo;תוכן משתמש&rdquo;</strong> — כל מידע, טקסט, תמונה או נתון שהמשתמש מזין,
            מעלה או יוצר במסגרת השימוש בשירות.
          </LegalItem>
        </LegalList>
      </LegalSection>

      <LegalSection id="nature" title="3. אופי השירות">
        <LegalText>
          השירות מספק כלים טכנולוגיים לבעלי עסקים לניהול יומן תורים, לפרסום עמוד עסק ולקבלת זימונים
          מלקוחות. {BRAND.name} היא פלטפורמה מקשרת בלבד: השירות, הטיפול או המוצר עצמו ניתנים על ידי בעל
          העסק, והחברה אינה צד להתקשרות שבין בעל העסק ללקוח הקצה.
        </LegalText>
        <LegalText>
          החברה אינה אחראית לזמינות, לאיכות, למחיר או לאופן מתן השירות של בעלי העסקים, ואינה מתחייבת
          כי תור שנקבע יסופק בפועל. כל טענה בנוגע לשירות שניתן על ידי בעל עסק תופנה ישירות אליו.
        </LegalText>
      </LegalSection>

      <LegalSection id="registration" title="4. הרשמה וחשבון">
        <LegalText>
          חלק מרכיבי השירות מחייבים פתיחת חשבון. בעת ההרשמה אתם מתחייבים למסור פרטים נכונים, מדויקים
          ומעודכנים, ולעדכנם בעת הצורך. השימוש בשירות מותר לבני 18 ומעלה, או לתאגיד כדין.
        </LegalText>
        <LegalText>
          אתם אחראים לשמירת סודיות פרטי הגישה לחשבונכם ולכל פעולה המתבצעת בו. יש להודיע לחברה באופן מיידי
          על כל שימוש בלתי מורשה בחשבון. החברה רשאית לסרב לפתוח חשבון או לבטל חשבון קיים לפי שיקול דעתה
          הסביר ובכפוף לדין.
        </LegalText>
      </LegalSection>

      <LegalSection id="acceptable-use" title="5. שימוש מותר ואסור">
        <LegalText>השימוש בשירות ייעשה למטרות חוקיות בלבד ובהתאם לתנאים אלה. חל איסור, בין היתר:</LegalText>
        <LegalList>
          <LegalItem>להשתמש בשירות לכל מטרה בלתי חוקית או בניגוד לכל דין;</LegalItem>
          <LegalItem>לפגוע בזכויות של צדדים שלישיים, לרבות זכויות קניין רוחני ופרטיות;</LegalItem>
          <LegalItem>להעלות תוכן פוגעני, מטעה, מאיים, גזעני או בלתי הולם;</LegalItem>
          <LegalItem>לנסות לחדור, לשבש או לעקוף מנגנוני אבטחה של השירות;</LegalItem>
          <LegalItem>לבצע איסוף אוטומטי של מידע מהשירות ללא אישור מראש ובכתב;</LegalItem>
          <LegalItem>להעמיס על תשתיות השירות באופן החורג משימוש סביר.</LegalItem>
        </LegalList>
      </LegalSection>

      <LegalSection id="user-content" title="6. תכני משתמש">
        <LegalText>
          הבעלות בתוכן המשתמש נותרת בידי המשתמש. בהעלאת תוכן לשירות אתם מעניקים לחברה רישיון מוגבל,
          לא בלעדי, לצורך הפעלת השירות, אחסון התוכן והצגתו כחלק מתפעול הפלטפורמה בלבד.
        </LegalText>
        <LegalText>
          אתם מצהירים כי התוכן שאתם מעלים אינו מפר כל דין או זכות של צד שלישי, וכי הוא נכון ומדויק.
          החברה רשאית להסיר תוכן המפר תנאים אלה או את הדין.
        </LegalText>
      </LegalSection>

      <LegalSection id="bookings" title="7. זימון תורים, ביטולים ואי־הגעה">
        <LegalText>
          מדיניות הביטולים, דמי הביטול ותנאי אי־ההגעה נקבעים על ידי בעל העסק ומוצגים בעמוד העסק או
          בעת קביעת התור. באחריות לקוח הקצה לעיין בהם טרם הזמנת התור.
        </LegalText>
        <LegalText>
          החברה מספקת את הכלי הטכנולוגי לניהול התורים והתזכורות בלבד, ואינה צד להסדרי הביטול או הגבייה
          שבין בעל העסק ללקוח. תזכורות אוטומטיות הן שירות עזר, ואין בהיעדר תזכורת כדי לגרוע מאחריות לקוח
          הקצה להגיע לתור שקבע.
        </LegalText>
      </LegalSection>

      <LegalSection id="payments" title="8. תשלומים ומינויים">
        <LegalText>
          ככל שרכיב מרכיבי השירות כרוך בתשלום, יוצגו התנאים, המחירים ומועדי החיוב טרם ההתקשרות.
          המחירים עשויים לכלול או לא לכלול מס ערך מוסף בהתאם למצוין. מינוי מתחדש יימשך עד לביטולו בהתאם
          למנגנון הביטול המוצג בשירות ובהתאם לדין.
        </LegalText>
        <LegalText>
          זכות הביטול של עסקה צרכנית תהיה בהתאם להוראות חוק הגנת הצרכן, התשמ״א-1981, והתקנות מכוחו,
          ככל שהן חלות. עיבוד התשלומים עשוי להתבצע באמצעות ספקי סליקה חיצוניים, בכפוף לתנאיהם.
        </LegalText>
      </LegalSection>

      <LegalSection id="ip" title="9. קניין רוחני">
        <LegalText>
          מלוא זכויות הקניין הרוחני בשירות, לרבות התוכנה, העיצוב, הסימנים המסחריים, הלוגו והתכנים
          שהחברה יצרה, שייכות לחברה או לנותני הרישיון שלה ומוגנות על פי דין. השם {BRAND.name} וסימני
          המסחר הנלווים לו הם קניינה של החברה.
        </LegalText>
        <LegalText>
          אין להעתיק, לשכפל, להפיץ, לשנות או ליצור יצירות נגזרות מן השירות או מכל חלק ממנו, אלא באישור
          מראש ובכתב מהחברה או כמותר במפורש על פי דין.
        </LegalText>
      </LegalSection>

      <LegalSection id="privacy-ref" title="10. פרטיות">
        <LegalText>
          השימוש בשירות כפוף גם למדיניות הפרטיות שלנו, המהווה חלק בלתי נפרד מתנאים אלה ומפרטת כיצד אנו
          אוספים, משתמשים ומגנים על מידע. מומלץ לעיין בה בעיון.
        </LegalText>
      </LegalSection>

      <LegalSection id="liability" title="11. אחריות והגבלתה">
        <LegalText>
          השירות ניתן כמות שהוא (&rdquo;AS IS&rdquo;) וכפי זמינותו (&rdquo;AS AVAILABLE&rdquo;). החברה
          עושה מאמצים סבירים לספק שירות תקין ורציף, אך אינה מתחייבת כי השירות יהיה נטול תקלות, זמין
          בכל עת או חף משגיאות.
        </LegalText>
        <LegalText>
          במידה המרבית המותרת על פי דין, החברה לא תישא באחריות לכל נזק עקיף, תוצאתי, מיוחד או מקרי,
          לרבות אובדן רווחים, מוניטין או נתונים, הנובע מהשימוש בשירות או מאי־היכולת להשתמש בו. אין
          באמור כדי לגרוע מאחריות שאינה ניתנת להגבלה או להתנאה על פי דין.
        </LegalText>
      </LegalSection>

      <LegalSection id="indemnity" title="12. שיפוי">
        <LegalText>
          אתם מתחייבים לשפות ולפצות את החברה, עובדיה ומי מטעמה, בגין כל נזק, הפסד, הוצאה או תביעה,
          לרבות שכר טרחת עורך דין, הנובעים מהפרת תנאים אלה על ידכם, משימוש בלתי חוקי בשירות או מפגיעה
          בזכויות צד שלישי.
        </LegalText>
      </LegalSection>

      <LegalSection id="suspension" title="13. השעיה וסיום">
        <LegalText>
          החברה רשאית להשעות או להפסיק את הגישה לשירות, כולו או חלקו, בכל עת, מטעמי אבטחה, תחזוקה, הפרת
          תנאים או דרישת דין. אתם רשאים להפסיק את השימוש בשירות ולסגור את חשבונכם בכל עת.
        </LegalText>
        <LegalText>
          עם סיום ההתקשרות, הוראות שמטבען נועדו לחול גם לאחר הסיום — לרבות קניין רוחני, הגבלת אחריות,
          שיפוי ודין חל — יוסיפו לעמוד בתוקפן.
        </LegalText>
      </LegalSection>

      <LegalSection id="changes" title="14. שינויים בתנאים ובשירות">
        <LegalText>
          החברה רשאית לעדכן תנאים אלה מעת לעת. נוסח מעודכן יפורסם בעמוד זה עם עדכון תאריך &rdquo;עודכן
          לאחרונה&rdquo;. המשך השימוש בשירות לאחר פרסום השינוי מהווה הסכמה לתנאים המעודכנים. כן רשאית
          החברה לשנות, להוסיף או להסיר רכיבים מהשירות.
        </LegalText>
      </LegalSection>

      <LegalSection id="law" title="15. דין חל וסמכות שיפוט">
        <LegalText>
          על תנאים אלה יחולו דיני מדינת ישראל בלבד. סמכות השיפוט הבלעדית בכל עניין הנוגע לתנאים אלה
          תהיה נתונה לבתי המשפט המוסמכים ב{LEGAL_COMPANY.jurisdictionCity}, ישראל.
        </LegalText>
      </LegalSection>

      <LegalSection id="contact" title="16. יצירת קשר">
        <LegalText>בכל שאלה בנוגע לתנאים אלה ניתן לפנות אלינו:</LegalText>
        <LegalList>
          {contactDetails.map((detail) => (
            <LegalItem key={detail.label}>
              {detail.label}: {detail.value}
            </LegalItem>
          ))}
        </LegalList>
      </LegalSection>
    </LegalArticle>
  );
}
