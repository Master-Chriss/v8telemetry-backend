import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: [true, 'Organization name is required'],
			trim: true,
			minlength: [2, 'Organization name must contain at least 2 characters'],
			maxlength: [120, 'Organization name cannot exceed 120 characters'],
		},

		slug: {
			type: String,
			required: [true, 'Organization slug is required'],
			trim: true,
			lowercase: true,
			match: [
				/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
				'Slug must contain lowercase letters, numbers, and single hyphens',
			],
		},

		status: {
			type: String,
			enum: ['active', 'suspended'],
			default: 'active',
			required: true,
		},
	},
	{
		timestamps: true,
		strict: 'throw',
	},
);

// Organization slugs must be globally unique.
organizationSchema.index({ slug: 1 }, { unique: true });

const Organization = mongoose.model('Organization', organizationSchema);

export default Organization;
