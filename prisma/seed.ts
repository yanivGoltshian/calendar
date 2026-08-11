/**
 * סקריפט אכלוס (seed) — עסק דמו מלא כדי שהאפליקציה תרוץ מיד.
 * יוצר: עסק + הגדרות, בעלים, שני אנשי צוות, שירותים, שעות עבודה (עם הפסקות),
 * וכמה תורים לדוגמה להיום.
 *
 * הרצה: npm run db:seed
 */
import { PrismaClient, type Service } from '@prisma/client';
import { normalizePhone } from '../src/lib/crypto';
import { localWallTimeToUtc, todayDateString } from '../src/lib/time';

const prisma = new PrismaClient();

const TZ = 'Asia/Jerusalem';
const SLUG = 'demo-barbershop';

// שעות עבודה שבועיות סטנדרטיות (ראשון עד חמישי) בדקות מתחילת היום.
function weekdayHours(
  start: number,
  end: number,
  breaks: [number, number][] = [],
) {
  // 0=ראשון ... 4=חמישי
  return [0, 1, 2, 3, 4].map((weekday) => ({
    weekday,
    startMinute: start,
    endMinute: end,
    breaks,
  }));
}

async function main() {
  console.log('מנקה נתוני דמו קודמים…');
  // מחיקה מבוקרת של העסק הקיים. יש למחוק קודם את התורים כדי לנקות את
  // AppointmentService (FK serviceId עם onDelete: Restrict) לפני שה-cascade
  // של העסק מנסה למחוק את השירותים.
  const existingBusiness = await prisma.business.findUnique({
    where: { slug: SLUG },
    select: { id: true },
  });
  if (existingBusiness) {
    await prisma.appointment.deleteMany({ where: { businessId: existingBusiness.id } });
    await prisma.business.deleteMany({ where: { slug: SLUG } });
  }
  // ניקוי משתמשי דמו יתומים לפי טלפון.
  const demoPhones = ['050-1111111', '050-2222222', '050-3333333', '052-9876543'].map(
    normalizePhone,
  );
  await prisma.user.deleteMany({ where: { phone: { in: demoPhones } } });

  console.log('יוצר בעל עסק…');
  const owner = await prisma.user.create({
    data: {
      phone: normalizePhone('050-1111111'),
      name: 'יניב לוי',
      role: 'OWNER',
    },
  });

  console.log('יוצר עסק והגדרות…');
  const business = await prisma.business.create({
    data: {
      slug: SLUG,
      name: 'מספרת הבית',
      type: 'BARBERSHOP',
      description:
        'מספרת בוטיק לכל המשפחה בלב תל אביב. תספורות גברים ונשים, עיצוב זקן, פן, החלקות ומניקור, באווירה חמה ומקצועית. קובעים תור אונליין בכמה שניות.',
      address: 'רחוב דיזנגוף 100, תל אביב',
      phone: normalizePhone('03-1234567'),
      instagramUrl: 'https://instagram.com/demo_barbershop',
      logoUrl: '/brand/business/demo-barbershop.png',
      coverImageUrl: null,
      timezone: TZ,
      ownerId: owner.id,
      settings: {
        create: {
          minLeadTimeMinutes: 120,
          cancellationWindowHours: 24,
          slotGranularityMinutes: 15,
          maxAdvanceBookingDays: 60,
        },
      },
      // שעות פעילות ברמת העסק (scope BUSINESS): א׳-ה׳ 09:00-19:00, ו׳ 09:00-14:00, שבת סגור.
      workingHours: {
        create: [
          ...[0, 1, 2, 3, 4].map((weekday) => ({
            scope: 'BUSINESS' as const,
            weekday,
            startMinute: 9 * 60,
            endMinute: 19 * 60,
            breaks: [],
          })),
          {
            scope: 'BUSINESS' as const,
            weekday: 5,
            startMinute: 9 * 60,
            endMinute: 14 * 60,
            breaks: [],
          },
        ],
      },
    },
  });

  console.log('יוצר שירותים…');
  const servicesData = [
    { name: 'תספורת גברים', durationMin: 30, priceAgorot: 8000, sortOrder: 1 },
    { name: 'עיצוב זקן', durationMin: 20, priceAgorot: 5000, sortOrder: 2 },
    {
      name: 'תספורת + זקן',
      durationMin: 45,
      priceAgorot: 11000,
      sortOrder: 3,
    },
    {
      name: 'תספורת ילדים',
      durationMin: 20,
      priceAgorot: 6000,
      sortOrder: 4,
      hideDuration: true,
    },
    { name: 'תספורת נשים', durationMin: 45, priceAgorot: 14000, sortOrder: 5 },
    { name: 'פן ועיצוב', durationMin: 40, priceAgorot: 9000, sortOrder: 6 },
    { name: 'מניקור ג׳ל', durationMin: 50, priceAgorot: 12000, sortOrder: 7 },
    {
      name: 'החלקת שיער',
      durationMin: 120,
      priceAgorot: 35000,
      sortOrder: 8,
      hidePrice: true,
    },
    {
      name: 'צביעת שיער',
      durationMin: 75,
      priceAgorot: 18000,
      sortOrder: 9,
      hidden: true, // מוסתר מהעמוד הציבורי לצורך הדגמה
    },
  ];
  const services: Service[] = [];
  for (const s of servicesData) {
    services.push(
      await prisma.service.create({
        data: { ...s, businessId: business.id },
      }),
    );
  }

  console.log('יוצר אנשי צוות…');
  const staffSpecs = [
    {
      phone: '050-2222222',
      name: 'יניב לוי',
      displayName: 'יניב',
      title: 'בעלים וספר בכיר',
      bio: 'מייסד מספרת הבית. מתמחה בתספורות גברים, עיצוב זקן וטיפוח קלאסי, עם יחס אישי לכל לקוח.',
      avatarUrl: '/brand/mascots/adam-head.png',
      permissionLevel: 'MANAGER' as const,
      // ראשון-חמישי 09:00-19:00 עם הפסקה 13:00-14:00
      hours: weekdayHours(9 * 60, 19 * 60, [[13 * 60, 14 * 60]]),
    },
    {
      phone: '050-3333333',
      name: 'גלי אלון',
      displayName: 'גלי',
      title: 'מעצבת שיער ומניקור',
      bio: 'מעצבת שיער נשים, פן, החלקות ומניקור. יד רכה, אוזן קשבת ותשומת לב לכל פרט.',
      avatarUrl: '/brand/mascots/maya-head.png',
      permissionLevel: 'CALENDAR_ONLY' as const,
      // ראשון-חמישי 10:00-19:00 עם הפסקה 14:00-15:00
      hours: weekdayHours(10 * 60, 19 * 60, [[14 * 60, 15 * 60]]),
    },
  ];

  const staff = [];
  for (const spec of staffSpecs) {
    const user = await prisma.user.create({
      data: {
        phone: normalizePhone(spec.phone),
        name: spec.name,
        role: 'STAFF',
      },
    });
    const member = await prisma.staffMember.create({
      data: {
        businessId: business.id,
        userId: user.id,
        displayName: spec.displayName,
        title: spec.title,
        bio: spec.bio,
        avatarUrl: spec.avatarUrl,
        permissionLevel: spec.permissionLevel,
        workingHours: {
          create: spec.hours.map((h) => ({
            scope: 'STAFF' as const,
            weekday: h.weekday,
            startMinute: h.startMinute,
            endMinute: h.endMinute,
            breaks: h.breaks,
          })),
        },
      },
    });
    staff.push(member);
  }

  console.log('מקשר צוות לשירותים…');
  // ServiceStaff (m2m): יניב מבצע שירותי גברים וילדים; גלי שירותי נשים, מניקור וצביעה.
  const staffServiceLinks: Array<{ staffIdx: number; serviceIdxs: number[] }> = [
    { staffIdx: 0, serviceIdxs: [0, 1, 2, 3] },
    { staffIdx: 1, serviceIdxs: [4, 5, 6, 7, 8] },
  ];
  for (const link of staffServiceLinks) {
    for (const svcIdx of link.serviceIdxs) {
      await prisma.serviceStaff.create({
        data: {
          serviceId: services[svcIdx].id,
          staffId: staff[link.staffIdx].id,
        },
      });
    }
  }

  console.log('יוצר לקוח ותורים לדוגמה…');
  const client = await prisma.client.create({
    data: {
      businessId: business.id,
      name: 'משה ישראלי',
      phone: normalizePhone('052-9876543'),
      notes: 'מעדיף תספורת קצרה בצדדים.',
    },
  });

  // תורים לדוגמה להיום: יניב (staff[0]) וגלי (staff[1]).
  const today = todayDateString(TZ);
  const [y, m, d] = today.split('-').map(Number);

  function apptAt(startMinute: number, svc: (typeof services)[number]) {
    const startAt = localWallTimeToUtc(y, m, d, startMinute, TZ);
    const endAt = new Date(startAt.getTime() + svc.durationMin * 60_000);
    return { startAt, endAt, svc };
  }

  const sampleAppts = [
    { at: apptAt(10 * 60, services[0]), status: 'CONFIRMED' as const, staff: staff[0] },
    { at: apptAt(11 * 60 + 30, services[2]), status: 'PENDING' as const, staff: staff[0] },
    { at: apptAt(15 * 60, services[4]), status: 'CONFIRMED' as const, staff: staff[1] },
  ];

  for (const a of sampleAppts) {
    await prisma.appointment.create({
      data: {
        businessId: business.id,
        clientId: client.id,
        staffId: a.staff.id,
        startAt: a.at.startAt,
        endAt: a.at.endAt,
        status: a.status,
        totalPriceAgorot: a.at.svc.priceAgorot,
        confirmedAt: a.status === 'CONFIRMED' ? new Date() : null,
        services: {
          create: {
            serviceId: a.at.svc.id,
            nameSnapshot: a.at.svc.name,
            durationMinSnapshot: a.at.svc.durationMin,
            priceAgorotSnapshot: a.at.svc.priceAgorot,
          },
        },
        reminders: {
          create: {
            sendAt: new Date(a.at.startAt.getTime() - 24 * 60 * 60 * 1000),
            channel: 'SMS',
          },
        },
      },
    });
  }

  console.log('\n✓ האכלוס הושלם.');
  console.log(`  עסק:    ${business.name} (/b/${business.slug})`);
  console.log(`  צוות:   ${staff.length} אנשי צוות`);
  console.log(`  שירותים: ${services.length}`);
  console.log(`  תורים:  ${sampleAppts.length} להיום (${today})`);
}

main()
  .catch((e) => {
    console.error('שגיאה באכלוס:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
