import Message, { type IMessage } from "../models/Message.js";
import { GoogleGenAI } from "@google/genai";
import { MEMOERY_AI_SYS_PROP } from "../utils/MemoryAISYSPrompt.js";
import Memories, { type IMemories } from "../models/Memories.js";
import { type ISession } from "../models/Session.js";
import { DECISION_AI_SYS_PROP } from "../utils/DecisionAISYSPrompt.js";
import { REPLAY_AI_SYS_PROP } from "../utils/ReplayAISYSPrompt.js";
import type { Types } from "mongoose";
import type { CreateMemory } from "../types/Memory/create.js";
import type { UpdateMemory } from "../types/Memory/update.js";
import type { DeleteMemory } from "../types/Memory/delete.js";

const ai = new GoogleGenAI({});

class AgentService {
    async memoryAI(message: IMessage, oldMemories: IMemories[]) {
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
                    recentMessages: recentMessages,
                    relatedMemories: oldMemories
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

    async saveMemory(groupId: Types.ObjectId, memory: CreateMemory) {
        if(memory && memory.action && memory.action !== "create") {
            return;
        }
        try {
            console.log("Save memory:", memory)
            if (!memory) {
                return null;
            }

            const result = await Memories.create({
                ...memory.memory,
                groupId,
                embedding: await AgentService.generateEmbeddings(memory.memory.text)
            })
    
            console.log("Save Memory Inserted:", result);
    
            return result;
        } catch (error) {
            console.error("Save Memory failed:", error);
            throw error;
        }
    }

    async updateMemorie(memory: UpdateMemory) {
        if(memory && memory.action && memory.action !== "update") {
            return;
        }
        try {
            let existingMemory = await Memories.findById(memory.memoryId)
            if(!existingMemory) {
                return null;
            }

            existingMemory.text = memory.changes.text
            existingMemory.confidence = memory.changes.confidence
            await existingMemory.save()

            return existingMemory;
        } catch (error) {
            console.error("Update Memory Error:", error)
            return null;
        }
    }

    async deleteMemory(memory: DeleteMemory) {
        if(memory && memory.action && memory.action !== "delete") {
            return;
        }
        try {
            let result = await Memories.findByIdAndDelete(memory.memoryId)
            if(!result) {
                return null;
            }

            return result;
        } catch (error) {
            console.error("Delete Memory Error:", error)
            return null;
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
                        limit: 10,
                        filter: {
                            groupId: message.groupId
                        }
                    }
                },
                {
                    $project: {
                        _id: 1,
                        text: 1,
                        type: 1,
                        metadata: 1,
                        confidence: 1,
                        score: { $meta: "vectorSearchScore" }
                    }
                }
            ])
            console.log("Memory Retriver Res:", memories)

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