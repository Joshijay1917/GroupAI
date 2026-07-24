import mongoose, { Document, model, Model, Types } from "mongoose";

export interface IUser extends Document {
    gropuId: Types.ObjectId;
    whatsappUserId: string;
    name: string;
    phoneNumber?: string;
    isBot: boolean
}

const userSchema = new mongoose.Schema<IUser>({
    gropuId: {
        type: mongoose.Types.ObjectId,
        ref: 'Group'
    },
    whatsappUserId: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    phoneNumber: {
        type: String
    },
    isBot: {
        type: Boolean,
        default: false
    }
}, { timestamps: true })

const User: Model<IUser> = model('User', userSchema)

export default User