import mongoose, { Document, model, Model } from "mongoose";

export interface IMemories extends Document {
    type: "fact" | "task" | "reminder" | "decision" | "preference";
    text: string;
    metadata?: Record<string, any>;
    embedding?: number[];
    confidence: number;
}

const memoriesSchema = new mongoose.Schema<IMemories>({

}, { timestamps: true })

const Memories: Model<IMemories> = model('Memories', memoriesSchema)

export default Memories