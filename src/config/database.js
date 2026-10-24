import mongoose from 'mongoose';
import {env} from './env.js';


export const connectDatabase = async () => {
  mongoose.set("bufferCommands", false); // prevents Mongoose from silently queueing database operations while disconnected.
  try {
    await mongoose.connect(env.MONGODB_URI, { 
      serverSelectionTimeoutMS: 5000,
    });
    
    console.log('MongoDB Successfully connected.');
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    throw error;
  }
}


export const disconnectDatabase = async () => {
  if(mongoose.connection.readyState === 0) {
    return;
  }

  await mongoose.disconnect();
  console.log('MongoDB Disconnected.');
}