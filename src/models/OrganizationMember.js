import mongoose from 'mongoose';

const organizationMemberSchema = new mongoose.Schema(
	{
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: [true, 'User reference is required'],
		},

		organizationId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Organization',
			required: [true, 'Organization reference is required'],
		},

		role: {
			type: String,
			enum: ['owner', 'admin', 'operator', 'viewer'],
			default: 'viewer',
			required: true,
		},

		status: {
			type: String,
			enum: ['active', 'inactive'],
			default: 'active',
			required: true,
		},
	},
	{
		timestamps: true,
		strict: 'throw',
	},
);

// Prevent duplicate membership records for the same user and organization.
organizationMemberSchema.index(
	{ organizationId: 1, userId: 1 },
	{ unique: true },
);

// Supports queries for a user's active organizations.
organizationMemberSchema.index({ userId: 1, status: 1 });

// Supports queries for active members of an organization.
organizationMemberSchema.index({ organizationId: 1, status: 1 });

const OrganizationMember = mongoose.model(
	'OrganizationMember',
	organizationMemberSchema,
);

export default OrganizationMember;
