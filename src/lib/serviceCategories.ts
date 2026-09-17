import { z } from 'zod';

export const serviceCategorySchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(80),
  serviceIds: z.array(z.string().min(1).max(100)).max(1000),
});

export const serviceCategoriesSchema = z.object({
  revision: z.number().int().nonnegative(),
  enabled: z.boolean(),
  categories: z.array(serviceCategorySchema).max(100),
}).superRefine(({ categories }, ctx) => {
  const ids = new Set<string>();
  const services = new Set<string>();
  for (const category of categories) {
    if (ids.has(category.id) || category.id === 'all' || category.id === 'uncategorized') {
      ctx.addIssue({ code: 'custom', message: 'invalid_category_id' });
    }
    ids.add(category.id);
    for (const id of category.serviceIds) {
      if (services.has(id)) ctx.addIssue({ code: 'custom', message: 'duplicate_membership' });
      services.add(id);
    }
  }
});

export type ServiceCategory = z.infer<typeof serviceCategorySchema>;
export type ServiceCategories = z.infer<typeof serviceCategoriesSchema>;

export function readServiceCategories(value: unknown): ServiceCategories {
  return value == null
    ? { revision: 0, enabled: false, categories: [] }
    : serviceCategoriesSchema.parse(value);
}

export function publicServiceCategories(
  config: ServiceCategories,
  services: readonly { id: string }[],
): ServiceCategory[] {
  if (!config.enabled) return [];
  const visible = new Set(services.map(service => service.id));
  return config.categories.map(category => ({
    ...category,
    serviceIds: category.serviceIds.filter(id => visible.has(id)),
  }));
}

export function filterCategoryServices<T extends { id: string }>(
  services: readonly T[],
  categories: readonly ServiceCategory[],
  categoryId: string,
): readonly T[] {
  if (!categories.length || categoryId === 'all') return services;
  if (categoryId === 'uncategorized') {
    const assigned = new Set(categories.flatMap(category => category.serviceIds));
    return services.filter(service => !assigned.has(service.id));
  }
  const category = categories.find(category => category.id === categoryId);
  if (!category) return services;
  const members = new Set(category.serviceIds);
  return services.filter(service => members.has(service.id));
}

export function setServiceCategory(config: ServiceCategories, category: ServiceCategory): ServiceCategories {
  const assigned = new Set(category.serviceIds);
  const categories = config.categories.map(existing => existing.id === category.id
    ? category
    : { ...existing, serviceIds: existing.serviceIds.filter(id => !assigned.has(id)) });
  if (!categories.some(existing => existing.id === category.id)) categories.push(category);
  return { ...config, categories };
}
