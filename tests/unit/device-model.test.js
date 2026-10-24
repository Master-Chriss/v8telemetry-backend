import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import Device, {
	DEVICE_TYPES,
	DEVICE_CAPABILITIES,
	DEVICE_STATUSES,
} from '../../src/models/Device.js';

const createValidDevice = (overrides = {}) => ({
	name: 'Warehouse Sensor',
	type: 'iot_sensor',
	ownerType: 'Organization',
	ownerId: new mongoose.Types.ObjectId(),
	...overrides,
});

test('Device applies defaults and accepts a valid device', async () => {
	const device = new Device(createValidDevice());

	await device.validate();

	assert.equal(device.status, 'active');
	assert.deepEqual(device.capabilities, []);
	assert.equal(device.name, 'Warehouse Sensor');
	assert.equal(device.type, 'iot_sensor');
	assert.equal(device.serialNumber, undefined);
});

test('Device trims strings and accepts an optional serial number', async () => {
	const device = new Device(
		createValidDevice({
			name: '  Delivery Scooter  ',
			type: 'scooter',
			serialNumber: '  SCOOTER-001  ',
			manufacturer: '  Example Motors  ',
		}),
	);

	await device.validate();

	assert.equal(device.name, 'Delivery Scooter');
	assert.equal(device.serialNumber, 'SCOOTER-001');
	assert.equal(device.manufacturer, 'Example Motors');
});

test('Device rejects a missing name', async () => {
	const device = new Device(createValidDevice({ name: undefined }));

	await assert.rejects(device.validate(), (error) => {
		assert.ok(error.errors.name);
		return true;
	});
});

test('Device rejects an unsupported device type', async () => {
	const device = new Device(createValidDevice({ type: 'spaceship' }));

	await assert.rejects(device.validate(), (error) => {
		assert.ok(error.errors.type);
		return true;
	});
});

test('Device rejects an unsupported owner type', async () => {
	const device = new Device(createValidDevice({ ownerType: 'Vehicle' }));

	await assert.rejects(device.validate(), (error) => {
		assert.ok(error.errors.ownerType);
		return true;
	});
});

test('Device requires an owner ID', async () => {
	const device = new Device(createValidDevice({ ownerId: undefined }));

	await assert.rejects(device.validate(), (error) => {
		assert.ok(error.errors.ownerId);
		return true;
	});
});

test('Device accepts every declared device type', async (t) => {
	for (const type of DEVICE_TYPES) {
		await t.test(type, async () => {
			const device = new Device(createValidDevice({ type }));
			await device.validate();
			assert.equal(device.type, type);
		});
	}
});

test('Device accepts every declared capability', async (t) => {
	for (const capability of DEVICE_CAPABILITIES) {
		await t.test(capability, async () => {
			const device = new Device(
				createValidDevice({ capabilities: [capability] }),
			);

			await device.validate();
			assert.deepEqual(device.capabilities, [capability]);
		});
	}
});

test('Device rejects an unsupported capability', async () => {
	const device = new Device(
		createValidDevice({ capabilities: ['teleportation'] }),
	);

	await assert.rejects(device.validate(), (error) => {
		assert.ok(error.errors['capabilities.0']);
		return true;
	});
});

test('Device rejects duplicate capabilities', async () => {
	const device = new Device(
		createValidDevice({
			capabilities: ['location', 'location'],
		}),
	);

	await assert.rejects(device.validate(), (error) => {
		assert.ok(error.errors.capabilities);
		return true;
	});
});

test('Device applies the declared lifecycle statuses', async (t) => {
	for (const status of DEVICE_STATUSES) {
		await t.test(status, async () => {
			const device = new Device(createValidDevice({ status }));
			await device.validate();
			assert.equal(device.status, status);
		});
	}
});

test('Device rejects an unsupported lifecycle status', async () => {
	const device = new Device(createValidDevice({ status: 'destroyed' }));

	await assert.rejects(device.validate(), (error) => {
		assert.ok(error.errors.status);
		return true;
	});
});

test('Device declares a partial unique serial-number index per owner', () => {
	const indexes = Device.schema.indexes();

	const serialIndex = indexes.find(
		([keys, options]) =>
			options.name === 'unique_serial_number_per_owner' &&
			keys.ownerType === 1 &&
			keys.ownerId === 1 &&
			keys.serialNumber === 1,
	);

	assert.ok(serialIndex, 'Expected the serial-number index to exist');
	assert.equal(serialIndex[1].unique, true);
	assert.deepEqual(serialIndex[1].partialFilterExpression, {
		serialNumber: { $type: 'string' },
	});
});

test('Device declares the owner-and-status lookup index', () => {
	const indexes = Device.schema.indexes();

	const ownerStatusIndex = indexes.find(
		([keys, options]) =>
			options.name === 'devices_by_owner_and_status' &&
			keys.ownerType === 1 &&
			keys.ownerId === 1 &&
			keys.status === 1,
	);

	assert.ok(ownerStatusIndex);
});

test('Device rejects unknown fields because strict mode is throw', () => {
	assert.throws(
		() => new Device(createValidDevice({ unexpectedField: 'not allowed' })),
		(error) => {
			assert.equal(error.name, 'StrictModeError');
			assert.equal(error.path, 'unexpectedField');
			return true;
		},
	);
});


test('Device rejects a blank serial number', async () => {
	const device = new Device(createValidDevice({ serialNumber: '   ' }));

	await assert.rejects(
		device.validate(),
		(error) =>
			error.name === 'ValidationError' && Boolean(error.errors.serialNumber),
	);
});


test('Device accepts a missing serial number', async () => {
	const device = new Device(createValidDevice({ serialNumber: undefined }));

	await device.validate();

	assert.equal(device.serialNumber, undefined);
});

test('Device accepts null as an absent serial number', async () => {
	const device = new Device(createValidDevice({ serialNumber: null }));

	await device.validate();

	assert.equal(device.serialNumber, null);
});


