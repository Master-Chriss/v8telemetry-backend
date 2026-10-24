import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import { createDeviceService } from '../../src/services/device.service.js';

const createId = () => new mongoose.Types.ObjectId();

const makeQuery = (value) => ({
	select: async () => value,
});


const createHarness = ({
  requesterId = createId(),
  requesterStatus = 'active',
  requesterMissing = false,
  organizationId = createId(),
  organizationStatus = 'active',
  organizationMissing = false,
  membership = {
    role: 'owner',
    status: 'active',
  },
  userLookupError = null,
  organizationLookupError = null,
  membershipLookupError = null,
  deviceCreateError = null,
} = {}) => {
  const calls = {
    memberships: [],
    createdDevices: [],
  };

  const requester = {
    _id: requesterId,
    status: requesterStatus,
  };

  const UserModel = {
    findById: (id) => {
      if (userLookupError) {
        return {
          select: async () => {
            throw userLookupError;
          },
        };
      }

      if (
        requesterMissing ||
        id.toString() !== requesterId.toString()
      ) {
        return makeQuery(null);
      }

      return makeQuery(requester);
    },
  };

  const OrganizationModel = {
    findById: (id) => ({
      select: async () => {
        if (organizationLookupError) {
          throw organizationLookupError;
        }

        if (
          organizationMissing ||
          id.toString() !== organizationId.toString()
        ) {
          return null;
        }

        return {
          _id: organizationId,
          status: organizationStatus,
        };
      },
    }),
  };

  const OrganizationMemberModel = {
    findOne: async (filter) => {
      calls.memberships.push(filter);

      if (membershipLookupError) {
        throw membershipLookupError;
      }

      const roleAllowed =
        filter.role?.$in?.includes(membership?.role) ?? false;

      const statusMatches =
        membership?.status === filter.status;

      const userMatches =
        membership?.userId == null ||
        membership.userId.toString() === filter.userId.toString();

      const organizationMatches =
        membership?.organizationId == null ||
        membership.organizationId.toString() ===
          filter.organizationId.toString();

      return roleAllowed &&
        statusMatches &&
        userMatches &&
        organizationMatches
        ? membership
        : null;
    },
  };

  const DeviceModel = {
    create: async (deviceData) => {
      if (deviceCreateError) {
        throw deviceCreateError;
      }

      calls.createdDevices.push(deviceData);

      return {
        _id: createId(),
        ...deviceData,
      };
    },
  };

  const service = createDeviceService({
    UserModel,
    OrganizationModel,
    OrganizationMemberModel,
    DeviceModel,
  });

  return {
    service,
    calls,
    requesterId,
    organizationId,
  };
};


const validDeviceData = {
	name: 'Delivery Scooter 01',
	type: 'scooter',
	capabilities: ['location', 'battery_level'],
};

test('an individual can register a device under their own account', async () => {
	const { service, calls, requesterId } = createHarness();

	const device = await service.registerDevice({
		requesterId,
		ownerType: 'User',
		ownerId: requesterId,
		deviceData: validDeviceData,
	});

	assert.equal(device.ownerType, 'User');
	assert.equal(device.ownerId.toString(), requesterId.toString());
	assert.equal(calls.createdDevices.length, 1);
});

test('an individual cannot register a device for another user', async () => {
	const { service, calls, requesterId } = createHarness();
	const otherUserId = createId();

	await assert.rejects(
		service.registerDevice({
			requesterId,
			ownerType: 'User',
			ownerId: otherUserId,
			deviceData: validDeviceData,
		}),
		{
			statusCode: 403,
			message: 'You cannot register devices for another user',
		},
	);

	assert.equal(calls.createdDevices.length, 0);
});

test('an active organization owner can register an organization device', async () => {
	const { service, calls, requesterId, organizationId } = createHarness({
		membership: {
			role: 'owner',
			status: 'active',
		},
	});

	const device = await service.registerDevice({
		requesterId,
		ownerType: 'Organization',
		ownerId: organizationId,
		deviceData: validDeviceData,
	});

	assert.equal(device.ownerType, 'Organization');
	assert.equal(device.ownerId.toString(), organizationId.toString());
	assert.equal(calls.createdDevices.length, 1);

	assert.deepEqual(calls.memberships[0].role, {
		$in: ['owner', 'admin'],
	});

	assert.equal(calls.memberships[0].status, 'active');
});

test('an active organization admin can register an organization device', async () => {
	const { service, calls, requesterId, organizationId } = createHarness({
		membership: {
			role: 'admin',
			status: 'active',
		},
	});

	await service.registerDevice({
		requesterId,
		ownerType: 'Organization',
		ownerId: organizationId,
		deviceData: validDeviceData,
	});

	assert.equal(calls.createdDevices.length, 1);
});

test('operators and viewers cannot register organization devices', async (t) => {
	for (const role of ['operator', 'viewer']) {
		await t.test(`${role} is denied`, async () => {
			const { service, calls, requesterId, organizationId } = createHarness({
				membership: {
					role,
					status: 'active',
				},
			});

			await assert.rejects(
				service.registerDevice({
					requesterId,
					ownerType: 'Organization',
					ownerId: organizationId,
					deviceData: validDeviceData,
				}),
				{
					statusCode: 403,
					message: 'Active organization owner or admin membership is required',
				},
			);

			assert.equal(calls.createdDevices.length, 0);
		});
	}
});

test('inactive organization memberships cannot register devices', async () => {
	const { service, calls, requesterId, organizationId } = createHarness({
		membership: {
			role: 'owner',
			status: 'inactive',
		},
	});

	await assert.rejects(
		service.registerDevice({
			requesterId,
			ownerType: 'Organization',
			ownerId: organizationId,
			deviceData: validDeviceData,
		}),
		{
			statusCode: 403,
			message: 'Active organization owner or admin membership is required',
		},
	);

	assert.equal(calls.createdDevices.length, 0);
});

test('an inactive organization cannot receive registered devices', async () => {
	const { service, calls, requesterId, organizationId } = createHarness({
		organizationStatus: 'suspended',
	});

	await assert.rejects(
		service.registerDevice({
			requesterId,
			ownerType: 'Organization',
			ownerId: organizationId,
			deviceData: validDeviceData,
		}),
		{
			statusCode: 403,
			message: 'Organization is missing or inactive',
		},
	);

	assert.equal(calls.memberships.length, 0);
	assert.equal(calls.createdDevices.length, 0);
});

test('an inactive requester cannot register devices', async () => {
	const { service, calls, requesterId } = createHarness({
		requesterStatus: 'suspended',
	});

	await assert.rejects(
		service.registerDevice({
			requesterId,
			ownerType: 'User',
			ownerId: requesterId,
			deviceData: validDeviceData,
		}),
		{
			statusCode: 403,
			message: 'Requester account is missing or inactive',
		},
	);

	assert.equal(calls.createdDevices.length, 0);
});

test('an invalid requester ID is rejected', async () => {
	const { service, calls } = createHarness();

	await assert.rejects(
		service.registerDevice({
			requesterId: 'not-a-valid-object-id',
			ownerType: 'User',
			ownerId: createId(),
			deviceData: validDeviceData,
		}),
		{
			statusCode: 401,
			message: 'Authentication required',
		},
	);

	assert.equal(calls.createdDevices.length, 0);
});

test('an invalid owner type is rejected', async () => {
	const { service, calls, requesterId } = createHarness();

	await assert.rejects(
		service.registerDevice({
			requesterId,
			ownerType: 'SuperAdmin',
			ownerId: createId(),
			deviceData: validDeviceData,
		}),
		{
			statusCode: 400,
			message: 'Invalid device owner type',
		},
	);

	assert.equal(calls.createdDevices.length, 0);
});

test('an invalid owner ID is rejected', async () => {
	const { service, calls, requesterId } = createHarness();

	await assert.rejects(
		service.registerDevice({
			requesterId,
			ownerType: 'User',
			ownerId: 'invalid-owner-id',
			deviceData: validDeviceData,
		}),
		{
			statusCode: 400,
			message: 'Invalid device owner ID',
		},
	);

	assert.equal(calls.createdDevices.length, 0);
});

test('client-supplied ownership fields cannot override validated ownership', async () => {
	const { service, calls, requesterId } = createHarness();

	const attackerId = createId();
	const deviceData = {
		...validDeviceData,
		ownerType: 'Organization',
		ownerId: attackerId,
	};

	const device = await service.registerDevice({
		requesterId,
		ownerType: 'User',
		ownerId: requesterId,
		deviceData,
	});

	assert.equal(device.ownerType, 'User');
	assert.equal(device.ownerId.toString(), requesterId.toString());

	assert.equal(calls.createdDevices.length, 1);
	assert.equal(
		calls.createdDevices[0].ownerId.toString(),
		requesterId.toString(),
	);
});


test('a missing requester account is rejected', async () => {
	const { service, calls, requesterId } = createHarness({
		requesterMissing: true,
	});

	await assert.rejects(
		service.registerDevice({
			requesterId,
			ownerType: 'User',
			ownerId: requesterId,
			deviceData: validDeviceData,
		}),
		{
			statusCode: 403,
			message: 'Requester account is missing or inactive',
		},
	);

	assert.equal(calls.createdDevices.length, 0);
});

test('a missing organization is rejected', async () => {
	const { service, calls, requesterId, organizationId } = createHarness({
		organizationMissing: true,
	});

	await assert.rejects(
		service.registerDevice({
			requesterId,
			ownerType: 'Organization',
			ownerId: organizationId,
			deviceData: validDeviceData,
		}),
		{
			statusCode: 403,
			message: 'Organization is missing or inactive',
		},
	);

	assert.equal(calls.memberships.length, 0);
	assert.equal(calls.createdDevices.length, 0);
});


test('a membership for a different user is rejected', async () => {
	const requesterId = createId();
	const organizationId = createId();

	const { service, calls } = createHarness({
		requesterId,
		organizationId,
		membership: {
			userId: createId(),
			organizationId,
			role: 'owner',
			status: 'active',
		},
	});

	await assert.rejects(
		service.registerDevice({
			requesterId,
			ownerType: 'Organization',
			ownerId: organizationId,
			deviceData: validDeviceData,
		}),
		{
			statusCode: 403,
			message: 'Active organization owner or admin membership is required',
		},
	);

	assert.equal(calls.createdDevices.length, 0);
});



test('a membership for a different organization is rejected', async () => {
	const requesterId = createId();
	const organizationId = createId();
	const differentOrganizationId = createId();

	const { service, calls } = createHarness({
		requesterId,
		organizationId,
		membership: {
			userId: requesterId,
			organizationId: differentOrganizationId,
			role: 'owner',
			status: 'active',
		},
	});

	await assert.rejects(
		service.registerDevice({
			requesterId,
			ownerType: 'Organization',
			ownerId: organizationId,
			deviceData: validDeviceData,
		}),
		{
			statusCode: 403,
			message: 'Active organization owner or admin membership is required',
		},
	);

	assert.equal(calls.createdDevices.length, 0);
});


test('a membership database error propagates without creating a device', async () => {
	const databaseError = new Error('Simulated database failure');

	const { service, calls, requesterId, organizationId } = createHarness({
		membershipLookupError: databaseError,
	});

	await assert.rejects(
		service.registerDevice({
			requesterId,
			ownerType: 'Organization',
			ownerId: organizationId,
			deviceData: validDeviceData,
		}),
		(error) => error === databaseError,
	);

	assert.equal(calls.createdDevices.length, 0);
});

test('a device creation database error propagates', async () => {
	const databaseError = new Error('Simulated device creation failure');

	const { service, calls, requesterId } = createHarness({
		deviceCreateError: databaseError,
	});

	await assert.rejects(
		service.registerDevice({
			requesterId,
			ownerType: 'User',
			ownerId: requesterId,
			deviceData: validDeviceData,
		}),
		(error) => error === databaseError,
	);

	assert.equal(calls.createdDevices.length, 0);
});
