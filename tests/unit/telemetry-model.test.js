import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import Telemetry, {
	TELEMETRY_RETENTION_SECONDS,
} from '../../src/models/Telemetry.js';

const validTelemetry = () => ({
	meta: {
		deviceId: new mongoose.Types.ObjectId(),
	},
	measuredAt: new Date('2026-10-19T17:00:00.000Z'),
	measurements: {
		location: {
			latitude: -1.9441,
			longitude: 30.0619,
		},
		speed: 42.5,
		battery_level: 86,
	},
});

test('accepts a valid telemetry snapshot', async () => {
	const telemetry = new Telemetry(validTelemetry());

	await assert.doesNotReject(() => telemetry.validate());
});

test('requires a device ID', async () => {
	const telemetry = new Telemetry({
		...validTelemetry(),
		meta: {},
	});

	await assert.rejects(() => telemetry.validate());
});

test('requires a measurement timestamp', async () => {
	const data = validTelemetry();
	delete data.measuredAt;

	const telemetry = new Telemetry(data);

	await assert.rejects(() => telemetry.validate());
});

test('sets the ingestion timestamp automatically', () => {
	const telemetry = new Telemetry(validTelemetry());

	assert.ok(telemetry.ingestedAt instanceof Date);
});

test('rejects unsupported measurement keys', async () => {
	const telemetry = new Telemetry({
		...validTelemetry(),
		measurements: {
			unknown_sensor: 12,
		},
	});

	await assert.rejects(() => telemetry.validate());
});

test('rejects non-numeric speed values', async () => {
	const telemetry = new Telemetry({
		...validTelemetry(),
		measurements: {
			speed: 'fast',
		},
	});

	await assert.rejects(() => telemetry.validate());
});

test('rejects battery levels outside 0–100', async () => {
	const telemetry = new Telemetry({
		...validTelemetry(),
		measurements: {
			battery_level: 140,
		},
	});

	await assert.rejects(() => telemetry.validate());
});

test('rejects invalid geographic coordinates', async () => {
	const telemetry = new Telemetry({
		...validTelemetry(),
		measurements: {
			location: {
				latitude: 120,
				longitude: 30,
			},
		},
	});

	await assert.rejects(() => telemetry.validate());
});

test('rejects empty measurements', async () => {
	const telemetry = new Telemetry({
		...validTelemetry(),
		measurements: {},
	});

	await assert.rejects(() => telemetry.validate());
});

test('configures a time-series collection with 30-day retention', () => {
	assert.equal(telemetrySchemaOption('timeseries')?.timeField, 'measuredAt');

	assert.equal(telemetrySchemaOption('timeseries')?.metaField, 'meta');

	assert.equal(telemetrySchemaOption('expireAfterSeconds'), 2_592_000);

	assert.equal(TELEMETRY_RETENTION_SECONDS, 2_592_000);
});

const telemetrySchemaOption = (option) => Telemetry.schema.options[option];
