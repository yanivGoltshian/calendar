import { prisma } from '@/lib/db';
import { readServiceCategories, serviceCategoriesSchema } from '@/lib/serviceCategories';
import { createService, type ServiceInput } from './services';

export async function createCategorizedService(
  businessId: string, data: ServiceInput, categoryId: string,
) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Business" WHERE id = ${businessId} FOR UPDATE`;
    const business = await tx.business.findUnique({ where: { id: businessId }, select: { serviceCategories: true } });
    if (!business) return { ok: false as const, error: 'no_business' };
    const config = readServiceCategories(business.serviceCategories);
    const category = config.categories.find(category => category.id === categoryId);
    if (!config.enabled || !category || category.serviceIds.length >= 1000) {
      return { ok: false as const, error: 'invalid_category' };
    }
    const service = await createService(businessId, data, undefined, tx);
    await tx.business.update({
      where: { id: businessId },
      data: { serviceCategories: {
        ...config,
        revision: config.revision + 1,
        categories: config.categories.map(category => category.id === categoryId
          ? { ...category, serviceIds: [...category.serviceIds, service.id] } : category),
      } },
    });
    return { ok: true as const, service };
  });
}

export async function saveServiceCategories(businessId: string, input: unknown) {
  const parsed = serviceCategoriesSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: 'bad_request' };
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Business" WHERE id = ${businessId} FOR UPDATE`;
    const business = await tx.business.findUnique({
      where: { id: businessId },
      select: { serviceCategories: true },
    });
    if (!business) return { ok: false as const, error: 'no_business' };
    const current = readServiceCategories(business.serviceCategories);
    if (current.revision !== parsed.data.revision) {
      return { ok: false as const, error: 'conflict' };
    }
    const services = await tx.service.findMany({ where: { businessId }, select: { id: true } });
    const validIds = new Set(services.map(service => service.id));
    if (parsed.data.categories.some(category => category.serviceIds.some(id => !validIds.has(id)))) {
      return { ok: false as const, error: 'invalid_service' };
    }
    const categories = { ...parsed.data, revision: current.revision + 1 };
    await tx.business.update({ where: { id: businessId }, data: { serviceCategories: categories } });
    return { ok: true as const, categories };
  });
}
