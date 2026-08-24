import SectionHeading from './SectionHeading';

type Props = { title: string; pageUrl: string; eyebrow?: string };

// פיד פייסבוק — Page Plugin רשמי דרך iframe אנונימי (ללא SDK או app-id).
// מרונדר רק מתוך facebookFeedUrl מפורש (הצטרפות יזומה של בעל העסק), ומנותק
// לחלוטין מכפתור האייקון ב-socialLinks.facebook. RTL-safe, ממורכז ורספונסיבי.
export default function LandingFacebookFeed({ title, pageUrl, eyebrow }: Props) {
  const href = pageUrl.trim();
  if (!href) return null;

  const src =
    `https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(href)}` +
    '&tabs=timeline&width=340&height=500&small_header=false' +
    '&adapt_container_width=true&hide_cover=false&show_facepile=true';

  return (
    <section className="mt-16 sm:mt-24">
      <SectionHeading eyebrow={eyebrow} title={title} />
      <div className="mx-auto mt-10 flex max-w-[360px] justify-center overflow-hidden rounded-2xl border border-[color:var(--biz-border)] bg-white shadow-soft">
        <iframe
          src={src}
          title={title}
          width={340}
          height={500}
          loading="lazy"
          allow="encrypted-media"
          allowFullScreen
          style={{ border: 0, overflow: 'hidden' }}
        />
      </div>
    </section>
  );
}
