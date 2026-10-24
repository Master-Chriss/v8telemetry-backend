import mongoose from 'mongoose';
import { DEVICE_CAPABILITIES } from './Device.js';

export const TELEMETRY_RETENTION_SECONDS = 30 * 24 * 60 * 60; // 30 days in seconds

const NUMERIC_CAPABILITIES = new Set([
	'speed',
	'battery_level',
	'fuel_level',
	'temperature',
	'humidity',
	'altitude',
	'vibration',
]);

const STATUS_VALUES = Object.freeze({
	engine_status: ['running', 'stopped', 'idle', 'unknown'],
	door_status: ['open', 'closed', 'locked', 'unlocked', 'unknown'],
});

const isFiniteNumber = (value) =>
	typeof value === 'number' && Number.isFinite(value);

const isValidLocation = (value) =>
	value !== null &&
	typeof value === 'object' &&
	!Array.isArray(value) &&
	isFiniteNumber(value.latitude) &&
	value.latitude >= -90 &&
	value.latitude <= 90 &&
	isFiniteNumber(value.longitude) &&
	value.longitude >= -180 &&
	value.longitude <= 180 &&
	Object.keys(value).every((key) => ['latitude', 'longitude'].includes(key));

const isValidMeasurementValue = (key, value) => {
	if (key === 'location') {
		return isValidLocation(value);
	}

	if (NUMERIC_CAPABILITIES.has(key)) {
		if (!isFiniteNumber(value)) {
			return false;
		}

		if (key === 'battery_level' || key === 'fuel_level' || key === 'humidity') {
			return value >= 0 && value <= 100;
		}

		if (key === 'speed' || key === 'vibration') {
			return value >= 0;
		}

		return true;
	}

	if (key === 'engine_status' || key === 'door_status') {
		return typeof value === 'boolean' || STATUS_VALUES[key].includes(value);
	}

	return false;
};

const isValidMeasurements = (measurements) => {
	if (
		measurements === null ||
		typeof measurements !== 'object' ||
		Array.isArray(measurements)
	) {
		return false;
	}

	const keys = Object.keys(measurements);

	return (
		keys.length > 0 &&
		keys.every(
			(key) =>
				DEVICE_CAPABILITIES.includes(key) &&
				isValidMeasurementValue(key, measurements[key]),
		)
	);
};

const telemetrySchema = new mongoose.Schema(
	{
		meta: {
			deviceId: {
				type: mongoose.Schema.Types.ObjectId,
				required: [true, 'Telemetry device ID is required'],
			},
		},

		measuredAt: {
			type: Date,
			required: [true, 'Measurement timestamp is required'],
			validate: {
				validator: (value) =>
					value instanceof Date && Number.isFinite(value.getTime()),
				message: 'Measurement timestamp must be a valid date',
			},
		},

		ingestedAt: {
			type: Date,
			required: true,
			default: Date.now,
		},

		measurements: {
			type: mongoose.Schema.Types.Mixed,
			required: [true, 'At least one measurement is required'],
			validate: {
				validator: isValidMeasurements,
				message:
					'Measurements contain unsupported capabilities or invalid values',
			},
		},
	},
	{
		collection: 'telemetry',
		strict: 'throw',
		timeseries: {
			timeField: 'measuredAt',
			metaField: 'meta',
			granularity: 'seconds',
		},
		expireAfterSeconds: TELEMETRY_RETENTION_SECONDS,
	},
);

const Telemetry = mongoose.model('Telemetry', telemetrySchema);

export default Telemetry;
