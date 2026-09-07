import { prisma } from '../src/lib/db';
import { HERO_VIDEO, visualFixture } from '../e2e/visualFixtures';

async function main() {
  await visualFixture({ slug: 'visual-regression-published' });
  await visualFixture({ slug: 'visual-regression-basic', basic: true });
  await visualFixture({
    slug: 'visual-regression-youtube',
    video: 'https://www.youtube.com/watch?v=abcdefghijk',
  });
  await visualFixture({
    slug: 'visual-regression-vimeo',
    video: 'https://vimeo.com/123456789',
  });
  const synthetic = await prisma.business.findUniqueOrThrow({
    where: { slug: 'visual-regression-published' },
  });
  await prisma.business.update({
    where: { slug: 'skin-beauty' },
    data: {
      name: 'קליניקת בדיקה',
      phone: null,
      address: null,
      logoUrl: synthetic.logoUrl,
      coverImageUrl: synthetic.coverImageUrl,
      landingContent: {
        ...(synthetic.landingContent as Record<string, unknown>),
        heroVideoUrl: HERO_VIDEO,
        hotDeals: { title: 'הצעת בדיקה', text: 'תוכן מלאכותי להשוואה בלבד.' },
      },
    },
  });
  await prisma.$disconnect();
}
void main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
