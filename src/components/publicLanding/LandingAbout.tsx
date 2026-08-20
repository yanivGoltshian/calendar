import SectionHeading from './SectionHeading';

type Props = { title: string; text: string; eyebrow?: string };

// מקטע "עלינו" — טקסט חופשי שהעסק כותב על עצמו.
export default function LandingAbout({ title, text, eyebrow }: Props) {
  if (!text.trim()) return null;
  return (
    <section className="mt-16 sm:mt-24">
      <SectionHeading eyebrow={eyebrow} title={title} />
      <div className="mx-auto mt-10 max-w-2xl rounded-3xl border border-[color:var(--biz-border)] bg-white p-7 shadow-soft sm:p-10">
        <p className="whitespace-pre-line text-center leading-relaxed text-slate-700 sm:text-lg">{text}</p>
      </div>
    </section>
  );
}
