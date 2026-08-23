import SectionHeading from './SectionHeading';

type Props = { title: string; images: string[]; eyebrow?: string };

// גלריית תמונות — פסיפס יוקרתי כמו במוקאפ: התמונה הראשונה גדולה (2×2),
// אחת רחבה (2×1) והשאר ריבועים. במובייל יורד לשתי עמודות תוך שמירת הפרופורציות.
export default function LandingGallery({ title, images, eyebrow }: Props) {
  if (images.length === 0) return null;
  // דפוס הפסיפס לפי אינדקס: הראשונה 2×2, השישית 2×1, השאר תא בודד.
  const spanFor = (i: number) => {
    if (i === 0) return 'col-span-2 row-span-2';
    if (i === 5) return 'col-span-2';
    return '';
  };
  return (
    <section className="mt-16 sm:mt-24">
      <SectionHeading eyebrow={eyebrow} title={title} />
      <div className="mt-10 grid grid-cols-2 gap-3.5 [grid-auto-rows:150px] min-[821px]:grid-cols-4 min-[821px]:[grid-auto-rows:180px]">
        {images.map((url, i) => (
          <figure
            key={i}
            className={`group relative m-0 overflow-hidden rounded-2xl border border-[color:var(--biz-border)] bg-[var(--biz-soft)] shadow-soft ${spanFor(i)}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.06]"
            />
          </figure>
        ))}
      </div>
    </section>
  );
}
