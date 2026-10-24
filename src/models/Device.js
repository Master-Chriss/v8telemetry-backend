import mongoose from 'mongoose';

export const DEVICE_TYPES = Object.freeze([
	'car',
	'motorcycle',
	'scooter',
	'bicycle',
	'ebike',
	'drone',
	'gps_tracker',
	'iot_sensor',
]);

export const DEVICE_CAPABILITIES = Object.freeze([
	'location',
	'speed',
	'battery_level',
	'fuel_level',
	'temperature',
	'humidity',
	'altitude',
	'engine_status',
	'vibration',
	'door_status',
]);

export const DEVICE_STATUSES = Object.freeze([
	'active',
	'inactive',
	'maintenance',
	'retired',
]);

const deviceSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: [true, 'Device name is required'],
			trim: true,
			minlength: [2, 'Device name must contain at least 2 characters'],
			maxlength: [120, 'Device name cannot exceed 120 characters'],
		},

		type: {
			type: String,
			required: [true, 'Device type is required'],
			enum: {
				values: DEVICE_TYPES,
				message: 'Unsupported device type: {VALUE}',
			},
		},

		manufacturer: {
			type: String,
			trim: true,
			maxlength: [100, 'Manufacturer cannot exceed 100 characters'],
		},

		model: {
			type: String,
			trim: true,
			maxlength: [100, 'Device model cannot exceed 100 characters'],
		},

		hardwareVersion: {
			type: String,
			trim: true,
			maxlength: [50, 'Hardware version cannot exceed 50 characters'],
		},

		firmwareVersion: {
			type: String,
			trim: true,
			maxlength: [50, 'Firmware version cannot exceed 50 characters'],
		},

		serialNumber: {
			type: String,
			trim: true,
			maxlength: [150, 'Serial number cannot exceed 150 characters'],
			validate: {
				validator: (value) =>
					value === undefined || value === null || value.length > 0,
				message: 'Serial number cannot be blank',
			},
			// Optional; uniqueness is enforced by the partial compound index.
		},

		ownerType: {
			type: String,
			required: [true, 'Device owner type is required'],
			enum: {
				values: ['User', 'Organization'],
				message: 'Owner type must be User or Organization',
			},
		},

		ownerId: {
			type: mongoose.Schema.Types.ObjectId,
			required: [true, 'Device owner ID is required'],
			// The referenced model depends on ownerType.
			// Service logic must verify that this owner actually exists.
		},

		status: {
			type: String,
			enum: {
				values: DEVICE_STATUSES,
				message: 'Unsupported device status: {VALUE}',
			},
			default: 'active',
			required: true,
		},

		capabilities: {
			type: [
				{
					type: String,
					enum: {
						values: DEVICE_CAPABILITIES,
						message: 'Unsupported device capability: {VALUE}',
					},
				},
			],
			default: [],
			validate: {
				validator: (capabilities) =>
					new Set(capabilities).size === capabilities.length,
				message: 'Device capabilities must not contain duplicates',
			},
		},
	},
	{
		timestamps: true,
		strict: 'throw',
	},
);

// A supplied serial number must be unique within its owner.
// Devices without serial numbers are excluded from this unique index.
deviceSchema.index(
	{
		ownerType: 1,
		ownerId: 1,
		serialNumber: 1,
	},
	{
		unique: true,
		partialFilterExpression: {
			serialNumber: { $type: 'string' },
		},
		name: 'unique_serial_number_per_owner',
	},
);

// Supports listing an owner's devices by lifecycle status.
deviceSchema.index(
	{
		ownerType: 1,
		ownerId: 1,
		status: 1,
	},
	{
		name: 'devices_by_owner_and_status',
	},
);

const Device = mongoose.model('Device', deviceSchema);

export default Device;
