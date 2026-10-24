import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import Telemetry, {
	TELEMETRY_RETENTION_SECONDS,
} from '../../src/models/Telemetry.js';

const testUri = process.env.MONGODB_TEST_URI;

const isSafeTestDatabase = (() => {
	if (!testUri) return false;

	try {
		return new URL(testUri).pathname === '/v8telemetry_test_db';
	} catch {
		return false;
	}
})();

test(
	'Telemetry MongoDB integration',
	{
		skip: !testUri
			? 'Set MONGODB_TEST_URI to enable integration tests'
			: !isSafeTestDatabase
				? 'Refusing to run outside v8telemetry_test_db'
				: false,
	},
	async () => {
		const connection = mongoose.createConnection(testUri);

		try {
			await connection.asPromise();

			const TelemetryTest = connection.model(
				'Telemetry',
				Telemetry.schema,
				'telemetry',
			);

			await TelemetryTest.createCollection();

			const [collectionInfo] = await connection.db
				.listCollections({ name: 'telemetry' })
				.toArray();

			assert.ok(collectionInfo, 'Telemetry collection should exist');
			assert.equal(collectionInfo.type, 'timeseries');
			assert.equal(collectionInfo.options.timeseries.timeField, 'measuredAt');
			assert.equal(collectionInfo.options.timeseries.metaField, 'meta');
			assert.equal(
				Number(collectionInfo.options.expireAfterSeconds),
				TELEMETRY_RETENTION_SECONDS,
			);

			const deviceId = new mongoose.Types.ObjectId();
			const measuredAt = new Date('2026-10-20T10:00:00.000Z');

			const measurements = {
				speed: 42.5,
				battery_level: 87,
				location: {
					latitude: -1.9441,
					longitude: 30.0619,
				},
			};

			const saved = await TelemetryTest.create({
				meta: { deviceId },
				measuredAt,
				measurements,
			});

			const found = await TelemetryTest.findById(saved._id).lean();

			assert.ok(found, 'Saved telemetry should be readable');
			assert.equal(String(found.meta.deviceId), String(deviceId));
			assert.equal(
				new Date(found.measuredAt).toISOString(),
				measuredAt.toISOString(),
			);
			assert.ok(found.ingestedAt instanceof Date);
			assert.equal(found.measurements.speed, 42.5);
			assert.equal(found.measurements.battery_level, 87);
			assert.deepEqual(found.measurements.location, {
				latitude: -1.9441,
				longitude: 30.0619,
			});

			// Invalid measurements must be rejected by Mongoose validation.
			const invalidCases = [
				{
					name: 'unsupported measurement key',
					measurements: { unknown_sensor: 12 },
				},
				{
					name: 'non-numeric speed',
					measurements: { speed: 'fast' },
				},
				{
					name: 'battery level above 100',
					measurements: { battery_level: 140 },
				},
				{
					name: 'invalid latitude',
					measurements: {
						location: { latitude: 120, longitude: 30 },
					},
				},
				{
					name: 'empty measurements',
					measurements: {},
				},
			];

			for (const invalidCase of invalidCases) {
				await assert.rejects(
					() =>
						new TelemetryTest({
							meta: { deviceId },
							measuredAt,
							measurements: invalidCase.measurements,
						}).validate(),
					undefined,
					invalidCase.name,
				);
			}

			// Invalid documents must not be written by these validation-only checks.
			const storedCount = await TelemetryTest.countDocuments({
				'meta.deviceId': deviceId,
			});

			assert.equal(storedCount, 1, 'Only the valid snapshot should be stored');
		} finally {
			try {
				if (connection.readyState === 1) {
					await connection.dropCollection('telemetry').catch((error) => {
						if (error.codeName !== 'NamespaceNotFound' && error.code !== 26) {
							throw error;
						}
					});
				}
			} finally {
				await connection.close();
			}
		}
	},
);
