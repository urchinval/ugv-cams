import { test } from 'node:test';
import assert from 'node:assert/strict';
import { API_ROUTES, withModelId } from './api-routes.ts';

test('withModelId fills :id and keeps the rest of the route', () => {
  assert.equal(withModelId(API_ROUTES.model, 'abc123'), '/api/models/abc123');
  assert.equal(withModelId(API_ROUTES.modelLayout, 'abc123'), '/api/models/abc123/layout');
  assert.equal(withModelId(API_ROUTES.modelExport, 'a b'), '/api/models/a%20b/export');
});
