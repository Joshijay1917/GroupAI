import mongoose, { Document, model, Model, Types } from "mongoose";

export interface IMemories extends Document {
    type: "fact" | "task" | "reminder" | "decision" | "preference";
    text: string;
    groupId: Types.ObjectId;
    metadata?: Record<string, any>;
    embedding?: number[];
    confidence: number;
}

const memoriesSchema = new mongoose.Schema<IMemories>({
    type: {
        type: String,
        default: "fact"
    },
    text: {
        type: String,
        required: true
    },
    groupId: {
        type: mongoose.Types.ObjectId,
        ref: 'Group',
        required: true
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    embedding: {
        type: [Number],
        default: []
    },
    confidence: {
        type: Number,
        required: true
    }
}, { timestamps: true })

const Memories: Model<IMemories> = model('Memories', memoriesSchema)

export default Memories