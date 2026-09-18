import { prisma } from '../src/lib/db';
import { bookingFixture, cleanupFixture } from '../integration/fixtures';
import { t } from '../src/i18n';
import { test, expect } from './fixtures';

test.afterAll(() => prisma.$disconnect());

const storedReviews = [
  { name: 'נועה', quote: 'שירות מקצועי ונעים.' },
  { name: 'אורי', quote: 'התור התחיל בזמן והתוצאה מצוינת.' },
  { name: 'מיכל', quote: 'חוויית הזמנה פשוטה ושירות מעולה.' },
];
const googleUrl = 'https://g.page/r/synthetic-david/review';

for (const width of [390, 1366]) {
  for (const publicPageStyle of ['LANDING', 'BOOKING'] as const) {
    test(`${publicPageStyle} renders David-shaped stored reviews once at ${width}px`, async ({ page }) => {
      const f = await bookingFixture();
      try {
        const business = await prisma.business.update({
          where: { id: f.business.id },
          data: {
            name: 'המספרה של דוד',
            type: 'BARBERSHOP',
            publicPageStyle,
            landingContent: {
              heroHeadline: 'המספרה של דוד',
              testimonials: storedReviews,
              googleReviewsUrl: googleUrl,
              sections: { testimonials: true },
            },
          },
        });
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
        await page.goto(`/b/${business.slug}`);

        const heading = page.getByRole('heading', {
          name: t.publicPage.landing.testimonialsTitle,
          exact: true,
        });
        await expect(heading).toHaveCount(1);
        const section = page.locator('section').filter({ has: heading });
        await expect(section).toHaveCount(1);
        await expect(section.locator('figure')).toHaveCount(storedReviews.length);
        await expect(section.getByRole('link', {
          name: t.publicPage.landing.googleReviewsCta,
          exact: true,
        })).toHaveCount(0);
        await expect(section.getByRole('link', {
          name: t.reviews.write,
          exact: true,
        })).toHaveCount(1);
        await expect(section.getByText(t.publicPage.landing.googleReviewsLabel, { exact: true }))
          .toHaveCount(0);
      } finally {
        await cleanupFixture(f);
      }
    });
  }
}

test('a valid profile link without stored reviews renders one honest empty state', async ({ page }) => {
  const f = await bookingFixture();
  try {
    const business = await prisma.business.update({
      where: { id: f.business.id },
      data: {
        type: 'BARBERSHOP',
        publicPageStyle: 'LANDING',
        landingContent: { googleReviewsUrl: googleUrl, sections: { testimonials: true } },
      },
    });
    await page.goto(`/b/${business.slug}`);
    await expect(
      page.getByRole('heading', {
        name: t.publicPage.landing.testimonialsTitle,
        exact: true,
      }),
    ).toHaveCount(1);
    await expect(page.getByText(t.reviews.emptyPublic, { exact: true }))
      .toHaveCount(1);
    await expect(page.getByRole('link', {
      name: t.publicPage.landing.googleReviewsCta,
      exact: true,
    })).toHaveCount(0);
    await expect(page.locator('section').filter({
      has: page.getByRole('heading', {
        name: t.publicPage.landing.testimonialsTitle,
        exact: true,
      }),
    }).locator('figure')).toHaveCount(0);
    await expect(page.getByRole('link', {
      name: t.reviews.write,
      exact: true,
    })).toHaveCount(1);
  } finally {
    await cleanupFixture(f);
  }
});

test('invalid provider metadata never creates a wrong CTA and does not hide stored reviews', async ({ page }) => {
  const f = await bookingFixture();
  try {
    const business = await prisma.business.update({
      where: { id: f.business.id },
      data: {
        type: 'BARBERSHOP',
        publicPageStyle: 'BOOKING',
        landingContent: {
          testimonials: storedReviews,
          googleReviewsUrl: 'https://reviews.example.invalid/wrong-business',
          sections: { testimonials: true },
        },
      },
    });
    await page.goto(`/b/${business.slug}`);
    await expect(page.locator('figure')).toHaveCount(storedReviews.length);
    await expect(
      page.getByRole('link', {
        name: t.publicPage.landing.googleReviewsCta,
        exact: true,
      }),
    ).toHaveCount(0);
  } finally {
    await cleanupFixture(f);
  }
});

test('zero factual reviews and unusable provider metadata show only the honest review invitation', async ({ page }) => {
  const f = await bookingFixture();
  try {
    const business = await prisma.business.update({
      where: { id: f.business.id },
      data: {
        type: 'BARBERSHOP',
        publicPageStyle: 'LANDING',
        landingContent: {
          googleReviewsUrl: 'https://www.google.com/maps/search/?api=1&query=wrong+business',
          sections: { testimonials: true },
        },
      },
    });
    await page.goto(`/b/${business.slug}`);
    await expect(page.getByRole('heading', {
      name: t.publicPage.landing.googleReviewsLabel,
      exact: true,
    })).toHaveCount(0);
    await expect(page.getByRole('heading', {
      name: t.publicPage.landing.testimonialsTitle,
      exact: true,
    })).toHaveCount(1);
    await expect(page.getByText(t.reviews.emptyPublic, { exact: true })).toHaveCount(1);
    await expect(page.getByRole('link', {
      name: t.reviews.write,
      exact: true,
    })).toHaveCount(1);
    await expect(page.getByRole('link', {
      name: t.publicPage.landing.googleReviewsCta,
      exact: true,
    })).toHaveCount(0);
  } finally {
    await cleanupFixture(f);
  }
});
