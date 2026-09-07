import sharp from 'sharp';
import { prisma } from '../src/lib/db';
import { bookingFixture } from '../integration/fixtures';

export const HERO_VIDEO = '/images/visual-regression/hero-portrait.mp4';
export const VIEWPORTS = [360, 390, 768, 1366] as const;

export async function visualFixture({
  slug,
  basic = false,
  video = HERO_VIDEO,
}: { slug?: string; basic?: boolean; video?: string } = {}) {
  const fixture = await bookingFixture();
  const cover = await sharp({
    create: { width: 120, height: 90, channels: 3, background: '#a57861' },
  })
    .png()
    .toBuffer();
  const poster = await sharp({
    create: { width: 180, height: 320, channels: 3, background: '#317575' },
  })
    .png()
    .toBuffer();
  const image = `data:image/png;base64,${cover.toString('base64')}`;
  const posterImage = `data:image/png;base64,${poster.toString('base64')}`;
  fixture.business = await prisma.business.update({
    where: { id: fixture.business.id },
    data: {
      ...(slug ? { slug } : {}),
      name: basic ? 'עסק בדיקה בסיסי' : 'עסק בדיקה מעוצב',
      type: 'BARBERSHOP',
      publicPageStyle: basic ? 'BOOKING' : 'LANDING',
      coverImageUrl: basic ? null : image,
      logoUrl: image,
      landingContent: basic
        ? undefined
        : {
            heroHeadline: 'חוויה אישית בכל ביקור',
            heroSubtext:
              'זהו עסק מלאכותי לבדיקת התצוגה. בחרו את השירות ואת השעה הנוחים לכם.',
            heroEyebrow: 'עסק בדיקה',
            heroImages: [image, posterImage],
            heroVideoUrl: video,
            galleryImageUrls: [image, posterImage],
            about: 'תיאור העסק לצורך בדיקות תצוגה בלבד.',
            beforeAfter: [
              { beforeUrl: image, afterUrl: posterImage, label: 'השוואה מלאכותית' },
            ],
            sections: { beforeAfter: true, faq: true },
            faq: [
              {
                question: 'כיצד קובעים תור?',
                answer: 'בוחרים שירות ושעה וממשיכים לאישור.',
              },
            ],
          },
      settings: {
        update: {
          onboardingCompleted: true,
          onboardingSteps: {
            services: true,
            workingHours: true,
            branding: !basic,
            landing: !basic,
          },
        },
      },
    },
  });
  return fixture;
}
