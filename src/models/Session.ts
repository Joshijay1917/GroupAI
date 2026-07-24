import mongoose, { Document, model, Model, Types } from "mongoose";

export interface ISession extends Document {
    title: string;
    status: "active" | "closed";
    groupId: Types.ObjectId;
    participants: Types.ObjectId[];
    lastActivityAt: Date;
    messageIds: Types.ObjectId[];
    summary?: string;
}

const sessionSchema = new mongoose.Schema<ISession>({
    title: {
        type: String,
        required: true
    },
    status: {
        type: String,
        default: "active"
    },
    groupId: {
        type: mongoose.Types.ObjectId,
        ref: 'Group'
    },
    participants: [
        {
            type: mongoose.Types.ObjectId,
            ref: 'User'
        }
    ],
    lastActivityAt: {
        type: Date,
        default: new Date()
    },
    messageIds: [
        {
            type: mongoose.Schema.ObjectId,
            ref: 'Message'
        }
    ],
    summary: {
        type: String
    }
}, { timestamps: true })

const Session: Model<ISession> = model('Session', sessionSchema)

export default Session