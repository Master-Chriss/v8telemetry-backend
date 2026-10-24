import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import app from '../../src/app.js';

test('GET /api/health/live returns a successful liveness response', async () => {
	const response = await request(app).get('/api/health/live');

	assert.equal(response.status, 200);
	assert.equal(response.body.success, true);
	assert.equal(response.body.data.status, 'alive');
});

test('unknown routes return a consistent 404 response', async () => {
	const response = await request(app).get('/api/unknown');

	assert.equal(response.status, 404);
	assert.equal(response.body.success, false);
	assert.equal(response.body.error.code, 'ROUTE_NOT_FOUND');
});

// Readiness test requires a running MongoDB instance. Ensure MongoDB is running before executing this test.

test('GET /api/health/ready returns 503 when the database is disconnected', async () => {
	const mongoose = await import('mongoose');

	const originalReadyState = mongoose.default.connection.readyState;

	try {
		mongoose.default.connection.readyState = 0;

		const response = await request(app).get('/api/health/ready');

		assert.equal(response.status, 503);
		assert.equal(response.body.success, false);
		assert.equal(response.body.error.code, 'SERVICE_NOT_READY');
		assert.equal(response.body.data.status, 'not_ready');
	} finally {
		mongoose.default.connection.readyState = originalReadyState;
	}
});

// Test for malformed JSON payloads

test('malformed JSON returns a consistent 400 response', async () => {
	const response = await request(app)
		.post('/api/unknown')
		.set('Content-Type', 'application/json')
		.send('{');

	assert.equal(response.status, 400);
	assert.equal(response.body.success, false);
	assert.equal(response.body.error.code, 'INVALID_REQUEST');
	assert.equal(response.body.error.message, 'Request contains invalid JSON');
});

// Test oversized JSON payloads

test('oversized JSON returns a 413 response', async () => {
	const response = await request(app)
		.post('/api/unknown')
		.set('Content-Type', 'application/json')
		.send(JSON.stringify({ data: 'a'.repeat(1_100_000) }));

	assert.equal(response.status, 413);
	assert.equal(response.body.success, false);
	assert.equal(response.body.error.code, 'PAYLOAD_TOO_LARGE');
});
