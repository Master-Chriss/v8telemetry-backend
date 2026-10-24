import test from 'node:test';
import assert from 'node:assert/strict';

import OrganizationMember from '../../src/models/OrganizationMember.js';

test('OrganizationMember applies default role and status', async () => {
  const member = new OrganizationMember({
    userId: '68f000000000000000000001',
    organizationId: '68f000000000000000000002',
  });

  await member.validate();

  assert.equal(member.role, 'viewer');
  assert.equal(member.status, 'active');
  assert.equal(member.userId.toString(), '68f000000000000000000001');
  assert.equal(
    member.organizationId.toString(),
    '68f000000000000000000002',
  );
});

test('OrganizationMember accepts all defined roles', async (t) => {
  for (const role of ['owner', 'admin', 'operator', 'viewer']) {
    await t.test(role, async () => {
      const member = new OrganizationMember({
        userId: '68f000000000000000000001',
        organizationId: '68f000000000000000000002',
        role,
      });

      await member.validate();
      assert.equal(member.role, role);
    });
  }
});

test('OrganizationMember rejects an unsupported role', async () => {
  const member = new OrganizationMember({
    userId: '68f000000000000000000001',
    organizationId: '68f000000000000000000002',
    role: 'superAdmin',
  });

  await assert.rejects(
    member.validate(),
    (error) =>
      error.name === 'ValidationError' &&
      Boolean(error.errors.role),
  );
});

test('OrganizationMember rejects missing references', async () => {
  const member = new OrganizationMember({});

  await assert.rejects(
    member.validate(),
    (error) =>
      error.name === 'ValidationError' &&
      Boolean(error.errors.userId) &&
      Boolean(error.errors.organizationId),
  );
});

test('OrganizationMember declares a unique compound index', () => {
  const indexes = OrganizationMember.schema.indexes();

  assert.ok(
    indexes.some(
      ([keys, options]) =>
        keys.organizationId === 1 &&
        keys.userId === 1 &&
        options.unique === true,
    ),
  );
});


test('OrganizationMember declares both membership lookup indexes', () => {
	const indexes = OrganizationMember.schema.indexes();

	assert.ok(
		indexes.some(
			([keys]) =>
				keys.userId === 1 &&
				keys.status === 1 &&
				Object.keys(keys).length === 2,
		),
		'Expected an index for finding a user’s memberships by status',
	);

	assert.ok(
		indexes.some(
			([keys]) =>
				keys.organizationId === 1 &&
				keys.status === 1 &&
				Object.keys(keys).length === 2,
		),
		'Expected an index for finding an organization’s members by status',
	);
});


test('OrganizationMember rejects an unsupported status', async () => {
	const member = new OrganizationMember({
		userId: '68f000000000000000000001',
		organizationId: '68f000000000000000000002',
		status: 'suspended',
	});

	await assert.rejects(
		member.validate(),
		(error) => error.name === 'ValidationError' && Boolean(error.errors.status),
	);
});

test('OrganizationMember rejects unknown fields in strict mode', () => {
	assert.throws(
		() =>
			new OrganizationMember({
				userId: '68f000000000000000000001',
				organizationId: '68f000000000000000000002',
				unexpectedField: 'not allowed',
			}),
		(error) =>
			error.name === 'StrictModeError' && error.path === 'unexpectedField',
	);
});

