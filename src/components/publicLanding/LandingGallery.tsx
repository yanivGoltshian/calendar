type Props = { title: string; images: string[] };

// גלריית תמונות — רשת פשוטה ורספונסיבית של עבודות העסק.
export default function LandingGallery({ title, images }: Props) {
  if (images.length === 0) return null;
  return (
    <section className="mt-12">
      <h2 className="mb-5 text-xl font-bold text-slate-900">{title}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {images.map((url, i) => (
          <div
            key={i}
            className="aspect-[4/3] overflow-hidden rounded-2xl border border-[color:var(--biz-border)] bg-[var(--biz-soft)] shadow-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition duration-300 hover:scale-105"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
