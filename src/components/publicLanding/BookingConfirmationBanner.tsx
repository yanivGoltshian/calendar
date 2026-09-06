export default function BookingConfirmationBanner({ heading }: { heading: string }) {
  if (!heading.trim()) return null;
  return (
    <section id="lp-hello" role="status" className="mt-8 scroll-mt-24">
      <div className="rounded-[26px] border border-[#e7ddcd] bg-white p-5 shadow-soft sm:p-[26px]">
        <h2 className="font-display text-2xl font-black text-[color:var(--c-ink,#1b1715)]">{heading}</h2>
      </div>
    </section>
  );
}
