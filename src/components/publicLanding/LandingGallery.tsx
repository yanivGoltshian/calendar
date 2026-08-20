import SectionHeading from './SectionHeading';

type Props = { title: string; images: string[]; eyebrow?: string };

// גלריית תמונות — רשת רספונסיבית של עבודות העסק.
export default function LandingGallery({ title, images, eyebrow }: Props) {
  if (images.length === 0) return null;
  return (
    <section className="mt-16 sm:mt-24">
      <SectionHeading eyebrow={eyebrow} title={title} />
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {images.map((url, i) => (
          <div
            key={i}
            className="aspect-[4/3] overflow-hidden rounded-3xl border border-[color:var(--biz-border)] bg-[var(--biz-soft)] shadow-soft"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 hover:scale-105"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
