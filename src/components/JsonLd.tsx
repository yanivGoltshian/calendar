/**
 * מזריק JSON-LD בעמוד דרך <script type="application/ld+json">.
 * מקבל אובייקט סכימה (או מערך) ומטמיע אותו בבטחה.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // התוכן נבנה בצד השרת ממקורות מהימנים בלבד.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default JsonLd;
