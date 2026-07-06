import { model, Schema } from 'mongoose';

export interface UserDoc {
  username: string;
  passwordHash: string;
  displayName: string;
}

const userSchema = new Schema<UserDoc>(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

export const User = model('User', userSchema);
