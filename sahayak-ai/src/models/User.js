import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    phone_number: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    preferred_language: {
      type: String,
      enum: ['Hindi', 'English', 'Kannada', 'Tamil', 'Telugu', 'Bengali', 'Marathi', 'Gujarati'],
      default: 'Hindi',
    },
    caregiver_name: { type: String },
    caregiver_phone: { type: String, required: true },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const User = mongoose.model('User', UserSchema);