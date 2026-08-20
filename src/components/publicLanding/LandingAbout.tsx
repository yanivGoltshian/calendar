type Props = { title: string; text: string };

// מקטע "עלינו" — טקסט חופשי שהעסק כותב על עצמו.
export default function LandingAbout({ title, text }: Props) {
  if (!text.trim()) return null;
  return (
    <section className="mt-12">
      <div className="rounded-3xl border border-[color:var(--biz-border)] bg-white p-6 shadow-sm sm:p-8">
        <h2 className="mb-3 text-xl font-bold text-slate-900">{title}</h2>
        <p className="whitespace-pre-line leading-relaxed text-slate-700">{text}</p>
      </div>
    </section>
  );
}
