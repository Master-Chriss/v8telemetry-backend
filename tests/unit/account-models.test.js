import test from 'node:test';
import assert from 'node:assert/strict';

import User from '../../src/models/User.js';
import Organization from '../../src/models/Organization.js';

test('User normalizes email and applies default role and status', async () => {
	const user = new User({
		name: '  Chrispin  ',
		email: '  CHRIS@example.com  ',
		passwordHash: 'test-hash-placeholder',
	});

	await user.validate();

	assert.equal(user.name, 'Chrispin');
	assert.equal(user.email, 'chris@example.com');
	assert.equal(user.platformRole, 'user');
	assert.equal(user.status, 'active');
  assert.equal(user.createdAt, undefined);
  assert.equal(user.updatedAt, undefined);
});

test('User rejects a missing password hash', async () => {
	const user = new User({
		name: 'Chrispin',
		email: 'chris@example.com',
	});

	await assert.rejects(
		user.validate(),
		(error) =>
			error.name === 'ValidationError' && Boolean(error.errors.passwordHash),
	);
});

test('User rejects an invalid platform role', async () => {
	const user = new User({
		name: 'Chrispin',
		email: 'chris@example.com',
		passwordHash: 'test-hash-placeholder',
		platformRole: 'organizationAdmin',
	});

	await assert.rejects(
		user.validate(),
		(error) =>
			error.name === 'ValidationError' && Boolean(error.errors.platformRole),
	);
});

test('Organization normalizes its name and slug', async () => {
	const organization = new Organization({
		name: '  Kigali Fleet  ',
		slug: '  KIGALI-FLEET  ',
	});

	await organization.validate();

	assert.equal(organization.name, 'Kigali Fleet');
	assert.equal(organization.slug, 'kigali-fleet');
	assert.equal(organization.status, 'active');
	assert.equal(organization.createdAt, undefined);
	assert.equal(organization.updatedAt, undefined);
});

test('Organization rejects a slug containing spaces', async () => {
	const organization = new Organization({
		name: 'Kigali Fleet',
		slug: 'kigali fleet',
	});

	await assert.rejects(
		organization.validate(),
		(error) => error.name === 'ValidationError' && Boolean(error.errors.slug),
	);
});

test('User email and organization slug have unique indexes', () => {
	const userIndexes = User.schema.indexes();
	const organizationIndexes = Organization.schema.indexes();

	assert.ok(
		userIndexes.some(
			([keys, options]) => keys.email === 1 && options.unique === true,
		),
	);

	assert.ok(
		organizationIndexes.some(
			([keys, options]) => keys.slug === 1 && options.unique === true,
		),
	);
});


test('User and Organization schemas use strict throw mode', () => {
	assert.equal(User.schema.options.strict, 'throw');
	assert.equal(Organization.schema.options.strict, 'throw');
});

test('User rejects an invalid email address', async () => {
	const user = new User({
		name: 'Chrispin',
		email: 'not-an-email',
		passwordHash: 'test-hash-placeholder',
	});

	await assert.rejects(
		user.validate(),
		(error) => error.name === 'ValidationError' && Boolean(error.errors.email),
	);
});

test('Organization rejects an invalid slug format', async () => {
	const organization = new Organization({
		name: 'Kigali Fleet',
		slug: '-kigali-fleet',
	});

	await assert.rejects(
		organization.validate(),
		(error) => error.name === 'ValidationError' && Boolean(error.errors.slug),
	);
});
