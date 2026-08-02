import mongoose, { Document, model, Model, Types } from "mongoose";
import type { IMemories } from "./Memories.js";
import type { IGroup } from "./Group.js";

export interface IReminder extends Document {
    _id: Types.ObjectId,
    groupId: Types.ObjectId | IGroup,
    memoryId: Types.ObjectId | IMemories,
    remindAt: Date,
    status: "pending" | "sent" | "cancelled",
    origin: "user" | "system",
    text: string,
    createdAt: Date,
    updatedAt: Date
}

const reminderSchema = new mongoose.Schema<IReminder>({
    groupId: {
        type: mongoose.Types.ObjectId,
        ref: 'Group'
    },
    memoryId: {
        type: mongoose.Types.ObjectId,
        ref: 'Memories'
    },
    remindAt: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        default: "pending"
    },
    origin: {
        type: String,
        default: "user"
    },
    text: {
        type: String,
        default: ""
    }
}, { timestamps: true })

const Reminder: Model<IReminder> = model('Reminder', reminderSchema)

export default Reminder