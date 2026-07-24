import mongoose, { Document, model, Model, Types } from "mongoose";

export interface IMessage extends Document {
    _id: Types.ObjectId;
    groupId: Types.ObjectId;
    senderId: Types.ObjectId;
    receiverId: Types.ObjectId;
    text: string;
    aiGenerated: boolean;
    createdAt: Date
}

const messsageSchema = new mongoose.Schema<IMessage>({
    groupId: {
        type: mongoose.Types.ObjectId,
        ref: 'Group'
    },
    senderId: {
        type: mongoose.Types.ObjectId,
        ref: 'User'
    },
    receiverId: {
        type: mongoose.Types.ObjectId,
        ref: 'User'
    },
    text: {
        type: String,
        required: true
    },
    aiGenerated: {
        type: Boolean,
        default: false
    }
}, { timestamps: true })

const Message: Model<IMessage> = model<IMessage>('Message', messsageSchema)

export default Message;