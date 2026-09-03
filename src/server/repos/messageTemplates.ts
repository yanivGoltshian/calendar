import { prisma } from '@/lib/db';
import {
  resolveTemplateSave,
  type MessageTemplateInput,
} from '@/server/messages/save';

/**
 * Repo של דריסות תבניות ההודעות (MessageTemplate).
 * קריאה: מיפוי `${key}.${channel}` ⇐ {subject, body} לטעינת מסך ההגדרות.
 * כתיבה: לכל ערך מהטופס — upsert של דריסה או מחיקה (שחזור לברירת-המחדל).
 */

export type TemplateOverrideMap = Record<
  string,
  { subject: string | null; body: string }
>;

/**
 * טוען את כל דריסות התבניות של העסק כמפה לפי `${key}.${channel}`.
 * מוגן: בלי DATABASE_URL (בנייה/בדיקות) מחזיר מפה ריקה במקום לפנות ל-DB.
 */
export async function listMessageTemplateOverrides(
  businessId: string,
): Promise<TemplateOverrideMap> {
  if (!process.env.DATABASE_URL) return {};
  try {
    const rows = await prisma.messageTemplate.findMany({
      where: { businessId },
      select: { key: true, channel: true, subject: true, body: true },
    });
    const map: TemplateOverrideMap = {};
    for (const r of rows) map[`${r.key}.${r.channel}`] = { subject: r.subject, body: r.body };
    return map;
  } catch {
    return {};
  }
}

/**
 * שומר את דריסות התבניות מהטופס: לכל ערך מחליט resolveTemplateSave אם למחוק
 * (שחזור) או לכתוב דריסה. מחיקה עם deleteMany כדי לא לזרוק כשאין שורה קיימת.
 */
export async function saveMessageTemplateOverrides(
  businessId: string,
  inputs: MessageTemplateInput[],
): Promise<void> {
  for (const input of inputs) {
    const op = resolveTemplateSave(input);
    if (op.action === 'delete') {
      await prisma.messageTemplate.deleteMany({
        where: { businessId, key: input.key, channel: input.channel },
      });
    } else {
      await prisma.messageTemplate.upsert({
        where: {
          businessId_key_channel: {
            businessId,
            key: input.key,
            channel: input.channel,
          },
        },
        update: { subject: op.subject, body: op.body },
        create: {
          businessId,
          key: input.key,
          channel: input.channel,
          subject: op.subject,
          body: op.body,
        },
      });
    }
  }
}
