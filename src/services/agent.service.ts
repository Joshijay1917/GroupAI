import Message, { type IMessage } from "../models/Message.js";
import { GoogleGenAI } from "@google/genai";
import { MEMOERY_AI_SYS_PROP } from "../utils/MemoryAISYSPrompt.js";
import Memories, { type IMemories } from "../models/Memories.js";
import { type ISession } from "../models/Session.js";
import { DECISION_AI_SYS_PROP } from "../utils/DecisionAISYSPrompt.js";
import { REPLAY_AI_SYS_PROP } from "../utils/ReplayAISYSPrompt.js";
import type { Types } from "mongoose";

const ai = new GoogleGenAI({});

class AgentService {
    async memoryAI(message: IMessage) {
        console.log("MemoryAI: ", message.text)
        try {
            const recentMessages = await Message.find({ groupId: message.groupId }).sort({ createdAt: -1 }).limit(5).lean()
            const response = await ai.models.generateContent({
                model: "gemma-4-31b-it",
                contents: JSON.stringify({
                    currentMessage: {
                        sender: message.senderId,
                        text: message.text,
                        createdAt: message.createdAt
                    },
                    recentMessages: recentMessages
                }),
                config: {
                    systemInstruction: MEMOERY_AI_SYS_PROP,
                    responseMimeType: "application/json"
                }
            });
            console.log("MemoryAI Res:", response.text)
    
            if (!response.text) {
                throw new Error("Memory AI returned empty response.");
            }
    
            const result = JSON.parse(response.text)

            return result;
        } catch (error) {
            console.error("Memory AI error: ", error)
            return null;
        }
    }

    async saveMemories(groupId: Types.ObjectId, memories: IMemories[]) {
        try {
            console.log("Save Memories:", memories)
            if (memories.length === 0) {
                return []
            }
    
            const docs = await Promise.all(
                memories.map(async (memory) => ({
                    ...memory,
                    groupId,
                    embedding: await AgentService.generateEmbeddings(memory.text)
                }))
            );
    
            const result = await Memories.insertMany(docs);
    
            console.log("Inserted:", result);
    
            return result;
        } catch (error) {
            console.error("insertMany failed:", error);
            throw error;
        }
    }

    static async generateEmbeddings(text: string): Promise<number[]> {
        console.log("Generate Embeddings:", text)
        try {
            const response = await ai.models.embedContent({
                model: 'gemini-embedding-2',
                contents: text
            })
            const embedding = response.embeddings?.[0];

            if (!embedding?.values) {
                return [];
            }

            console.log("Embedding dimensions:", embedding.values.length);

            return embedding.values;
        } catch (error) {
            console.error("Generate embeddings error: ", error)
            return []
        }
    }

    async MemoryRetriever(message: IMessage) {
        console.log("Memory Retriver:", message)
        try {
            const embedding = await AgentService.generateEmbeddings(message.text)

            const memories = await Memories.aggregate([
                {
                    $vectorSearch: {
                        index: "memory_index",
                        path: "embedding",
                        queryVector: embedding,
                        numCandidates: 100,
                        limit: 5
                    }
                }
            ])
            console.log("Memory Retriver Res:", message)

            return memories;
        } catch (error) {
            console.error("Memory Retriver Error: ", error)
            return [];
        }
    }

    async decisionAI(message: IMessage, session: ISession, memories: IMemories[]) {
        console.log("Decision AI:", message.text)
        try {
            const recentMessages = await Message.find({ groupId: message.groupId }).sort({ createdAt: -1 }).limit(10).lean()
            const response = await ai.models.generateContent({
                model: "gemma-4-31b-it",
                contents: JSON.stringify({
                    currentMessage: message.text,
                    recentMessages,
                    session,
                    memories
                }),
                config: {
                    systemInstruction: DECISION_AI_SYS_PROP,
                    responseMimeType: "application/json"
                }
            })
            console.log("Decision AI Res:", JSON.parse(response.text!))
    
            return JSON.parse(response.text!);
        } catch (error) {
            console.error("Decision AI error: ", error)
            return null
        }
    }

    async replyAI(
        message: IMessage,
        session: ISession,
        memories: IMemories[]
    ): Promise<string> {
        console.log("Replay AI:", message.text)
        try {
            const recentMessages = await Message.find({ groupId: message.groupId }).sort({ createdAt: -1 }).limit(10).lean()
            const response = await ai.models.generateContent({
                model: "gemma-4-31b-it",
                contents: JSON.stringify({
                    currentMessage: {
                        sender: message.senderId,
                        text: message.text
                    },
                    recentMessages,
                    session,
                    memories
                }),
                config: {
                    systemInstruction: REPLAY_AI_SYS_PROP
                }
            })
            console.log("Replay AI Res:", response.text)
    
            return response.text ?? "";
        } catch (error) {
            console.error("Replay AI Error:", error)
            return "";
        }
    }
}

export default new AgentService()