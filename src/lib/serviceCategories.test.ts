import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  filterCategoryServices,
  publicServiceCategories,
  readServiceCategories,
  serviceCategoriesSchema,
  setServiceCategory,
  type ServiceCategories,
} from './serviceCategories';
import { parseAdminFormState } from './adminFormState';
import ServiceCategoryTabs from '../components/ServiceCategoryTabs';

const services = [{ id: 'a', name: 'First' }, { id: 'b', name: 'Second' }, { id: 'c', name: 'Third' }];
const config: ServiceCategories = {
  enabled: true,
  revision: 3,
  categories: [
    { id: 'face', name: 'Face', serviceIds: ['a', 'hidden'] },
    { id: 'body', name: 'Body', serviceIds: ['b'] },
    { id: 'empty', name: 'Empty', serviceIds: [] },
  ],
};

test('absent and disabled configuration preserve the original simple service flow', () => {
  assert.deepEqual(readServiceCategories(null), { revision: 0, enabled: false, categories: [] });
  assert.deepEqual(publicServiceCategories(readServiceCategories(null), services), []);
  assert.deepEqual(publicServiceCategories({ ...config, enabled: false }, services), []);
  assert.equal(filterCategoryServices(services, [], 'face'), services);
  assert.equal(renderToStaticMarkup(createElement(ServiceCategoryTabs, {
    categories: [], services, selected: 'all', onSelect() {},
  })), '');
});

test('public categories expose only currently visible service membership without changing owner configuration', () => {
  const result = publicServiceCategories(config, services);
  assert.deepEqual(result.map(category => category.serviceIds), [['a'], ['b'], []]);
  assert.deepEqual(config.categories[0].serviceIds, ['a', 'hidden']);
  assert.equal(result.length, 3);
});

test('all, category, uncategorized and empty filters preserve service order and original objects', () => {
  const categories = publicServiceCategories(config, services);
  assert.equal(filterCategoryServices(services, categories, 'all'), services);
  assert.deepEqual(filterCategoryServices(services, categories, 'face'), [services[0]]);
  assert.deepEqual(filterCategoryServices(services, categories, 'body'), [services[1]]);
  assert.deepEqual(filterCategoryServices(services, categories, 'uncategorized'), [services[2]]);
  assert.deepEqual(filterCategoryServices(services, categories, 'empty'), []);
  assert.equal(filterCategoryServices(services, categories, 'removed-category'), services);
});

test('renaming and selecting members moves services while preserving other categories and the original draft', () => {
  const before = structuredClone(config);
  const updated = setServiceCategory(config, { id: 'body', name: 'Updated', serviceIds: ['a', 'c'] });
  assert.deepEqual(updated.categories, [
    { id: 'face', name: 'Face', serviceIds: ['hidden'] },
    { id: 'body', name: 'Updated', serviceIds: ['a', 'c'] },
    { id: 'empty', name: 'Empty', serviceIds: [] },
  ]);
  assert.deepEqual(config, before);
  const created = setServiceCategory(updated, { id: 'new', name: 'New', serviceIds: ['c'] });
  assert.equal(created.categories.length, 4);
  assert.deepEqual(created.categories[1].serviceIds, ['a']);
});

test('empty names, duplicate category IDs and multiple memberships are rejected', () => {
  for (const categories of [
    [{ id: 'face', name: '   ', serviceIds: [] }],
    [{ id: 'all', name: 'Reserved', serviceIds: [] }],
    [{ id: 'uncategorized', name: 'Reserved', serviceIds: [] }],
    [{ id: 'same', name: 'One', serviceIds: [] }, { id: 'same', name: 'Two', serviceIds: [] }],
    [{ id: 'one', name: 'One', serviceIds: ['a'] }, { id: 'two', name: 'Two', serviceIds: ['a'] }],
    [{ id: 'one', name: 'One', serviceIds: ['a', 'a'] }],
  ]) {
    assert.equal(serviceCategoriesSchema.safeParse({ ...config, categories }).success, false);
  }
  assert.throws(() => readServiceCategories({ enabled: true }), /revision/);
});

test('save confirmations require a valid complete category snapshot and a successful response', () => {
  assert.deepEqual(parseAdminFormState({ ok: true, categories: config }).categories, config);
  assert.throws(() => parseAdminFormState({ ok: false, categories: config }), /Unexpected category/);
  assert.throws(() => parseAdminFormState({ ok: true, categories: {} }));
});
