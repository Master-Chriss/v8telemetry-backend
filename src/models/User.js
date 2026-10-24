
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must contain at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email address',
      ],
    },

    // Store a password hash, never a plaintext password.
    // Authentication and hashing logic come later.
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false,
    },

    platformRole: {
      type: String,
      enum: ['user', 'superAdmin'],
      default: 'user',
      required: true,
    },

    status: {
      type: String,
      enum: ['pending', 'active', 'suspended'],
      default: 'active',
      required: true,
    },
  },
  {
    timestamps: true,
    strict: 'throw', 
  },
);

// A unique index prevents duplicate email addresses at database level.
userSchema.index({ email: 1 }, { unique: true });

const User = mongoose.model('User', userSchema);

export default User;
