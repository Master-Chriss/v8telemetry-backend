import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';

import User from '../../src/models/User.js';
import Organization from '../../src/models/Organization.js';
import OrganizationMember from '../../src/models/OrganizationMember.js';
import Device from '../../src/models/Device.js';

const testUri = process.env.MONGODB_TEST_URI;

test(
	'MongoDB enforces account, membership, and device unique indexes',
	{ skip: !testUri },
	async () => {
		assert.match(
			new URL(testUri).pathname,
			/v8telemetry_test_db/,
			'Refusing to run outside v8telemetry_test_db',
		);

		const connection = mongoose.createConnection(testUri);

		const collections = [
			'users',
			'organizations',
			'organizationmembers',
			'devices',
		];

		try {
			await connection.asPromise();

			const TestUser = connection.model('User', User.schema, 'users');
			const TestOrganization = connection.model(
				'Organization',
				Organization.schema,
				'organizations',
			);
			const TestMembership = connection.model(
				'OrganizationMember',
				OrganizationMember.schema,
				'organizationmembers',
			);
			const TestDevice = connection.model('Device', Device.schema, 'devices');

			// Wait for MongoDB to finish building each declared index.
			await Promise.all([
				TestUser.init(),
				TestOrganization.init(),
				TestMembership.init(),
				TestDevice.init(),
			]);

			const duplicateKeyError = (error) => error?.code === 11000;

			// 1. Email must be unique.
			const email = 'unique-index-test@example.com';

			await TestUser.create({
				name: 'Index Test User',
				email,
				passwordHash: 'test-only-placeholder',
			});

			await assert.rejects(
				TestUser.create({
					name: 'Duplicate Email User',
					email,
					passwordHash: 'test-only-placeholder',
				}),
				duplicateKeyError,
				'MongoDB should reject duplicate user emails',
			);

			// 2. Organization slug must be unique.
			const slug = 'unique-index-test-org';

			await TestOrganization.create({
				name: 'Index Test Organization',
				slug,
			});

			await assert.rejects(
				TestOrganization.create({
					name: 'Duplicate Slug Organization',
					slug,
				}),
				duplicateKeyError,
				'MongoDB should reject duplicate organization slugs',
			);

			// 3. A user can have only one membership record per organization.
			const userId = new mongoose.Types.ObjectId();
			const organizationId = new mongoose.Types.ObjectId();

			await TestMembership.create({
				userId,
				organizationId,
			});

			await assert.rejects(
				TestMembership.create({
					userId,
					organizationId,
				}),
				duplicateKeyError,
				'MongoDB should reject duplicate user-organization memberships',
			);

			// 4. Serial numbers must be unique within the same owner.
			const ownerId = new mongoose.Types.ObjectId();
			const serialNumber = 'INDEX-TEST-SERIAL-001';

			await TestDevice.create({
				name: 'Index Test Device A',
				type: 'car',
				ownerType: 'User',
				ownerId,
				serialNumber,
			});

			await assert.rejects(
				TestDevice.create({
					name: 'Index Test Device B',
					type: 'car',
					ownerType: 'User',
					ownerId,
					serialNumber,
				}),
				duplicateKeyError,
				'MongoDB should reject duplicate serial numbers for one owner',
			);

			// The same serial number is allowed for a different owner.
			await TestDevice.create({
				name: 'Index Test Device C',
				type: 'car',
				ownerType: 'User',
				ownerId: new mongoose.Types.ObjectId(),
				serialNumber,
			});
		} finally {
			// Remove only collections owned by this integration test.
			for (const collection of collections) {
				try {
					await connection.dropCollection(collection);
				} catch (error) {
					if (error?.code !== 26 && error?.codeName !== 'NamespaceNotFound') {
						throw error;
					}
				}
			}

			await connection.close();
		}
	},
);
