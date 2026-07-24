import mongoose, { Document, model, Model, Types } from "mongoose";

export interface IGroup extends Document {
    whatsappUserId: string;
    name: string;
    description?: string;
    members: Types.ObjectId[];
    admins: Types.ObjectId[];
    aiEnabled: boolean;
    aiMode: "silent" | "assistant" | "active";
}

const groupSchema = new mongoose.Schema<IGroup>({
    whatsappUserId: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    members: [
        {
            type: mongoose.Types.ObjectId,
            ref: 'User'
        }
    ],
    admins: [
        {
            type: mongoose.Types.ObjectId,
            ref: 'User'
        }
    ],
    aiEnabled: {
        type: Boolean,
        default: true
    },
    aiMode: {
        type: String,
        default: "active"
    }
}, { timestamps: true })

const Group: Model<IGroup> = model('Group', groupSchema)

export default Group