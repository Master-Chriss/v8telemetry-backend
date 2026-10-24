
import mongoose from 'mongoose';

import User from '../models/User.js';
import Organization from '../models/Organization.js';
import OrganizationMember from '../models/OrganizationMember.js';
import Device from '../models/Device.js';

const createServiceError = (message, statusCode) =>
  Object.assign(new Error(message), { statusCode });

const getActiveRequester = async (UserModel, requesterId) => {
  if (!mongoose.isValidObjectId(requesterId)) {
    throw createServiceError('Authentication required', 401);
  }

  const requester = await UserModel.findById(requesterId)
    .select('status');

  if (!requester || requester.status !== 'active') {
    throw createServiceError(
      'Requester account is missing or inactive',
      403,
    );
  }

  return requester;
};

export const createDeviceService = ({
  UserModel = User,
  OrganizationModel = Organization,
  OrganizationMemberModel = OrganizationMember,
  DeviceModel = Device,
} = {}) => {
  const registerDevice = async ({
    requesterId,
    ownerType,
    ownerId,
    deviceData,
  }) => {
    const requester = await getActiveRequester(
      UserModel,
      requesterId,
    );

    if (!['User', 'Organization'].includes(ownerType)) {
      throw createServiceError('Invalid device owner type', 400);
    }

    if (!mongoose.isValidObjectId(ownerId)) {
      throw createServiceError('Invalid device owner ID', 400);
    }

    if (ownerType === 'User') {
      // Individuals can register devices only under their own account.
      if (requester._id.toString() !== ownerId.toString()) {
        throw createServiceError(
          'You cannot register devices for another user',
          403,
        );
      }
    }

    if (ownerType === 'Organization') {
      const organization = await OrganizationModel
        .findById(ownerId)
        .select('status');

      if (!organization || organization.status !== 'active') {
        throw createServiceError(
          'Organization is missing or inactive',
          403,
        );
      }

      const membership = await OrganizationMemberModel.findOne({
        userId: requester._id,
        organizationId: ownerId,
        status: 'active',
        role: { $in: ['owner', 'admin'] },
      });

      if (!membership) {
        throw createServiceError(
          'Active organization owner or admin membership is required',
          403,
        );
      }
    }

    // Set trusted ownership fields after spreading client-supplied data.
    // The Device model validates the resulting document.
    return DeviceModel.create({
      ...deviceData,
      ownerType,
      ownerId,
    });
  };

  return { registerDevice };
};

const deviceService = createDeviceService();

export const registerDevice = deviceService.registerDevice;

export default deviceService;
