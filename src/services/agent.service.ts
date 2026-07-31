import Message, { type IMessage } from "../models/Message.js";
import { GoogleGenAI } from "@google/genai";
import { MEMOERY_AI_SYS_PROP } from "../utils/MemoryAISYSPrompt.js";
import Memories from "../models/Memories.js";
import { DECISION_AI_SYS_PROP } from "../utils/DecisionAISYSPrompt.js";
import { REPLAY_AI_SYS_PROP } from "../utils/ReplayAISYSPrompt.js";
import type { Types } from "mongoose";
import type { CreateMemory } from "../types/Memory/create.js";
import type { UpdateMemory } from "../types/Memory/update.js";
import type { DeleteMemory } from "../types/Memory/delete.js";
import { ContextBuilder } from "../utils/ContextBuilder.js";
import type { ISession } from "../models/Session.js";
import { SUMMARY_AI_SYS_PROP } from "../utils/SummaryAISYSPrompt.js";
import type { CacheService } from "./cache.service.js";
import Reminder, { type IReminder } from "../models/Reminder.js";

const ai = new GoogleGenAI({});

class AgentService {
    private builder;

    constructor(builder: ContextBuilder) {
        this.builder = builder
    }

    async memoryAI() {
        console.log("Memory AI Started!")
        try {
            // const recentMessages = await Message.find({ groupId: message.groupId }).sort({ createdAt: -1 }).limit(20).lean()
            const context = this.builder.generateMemoryAI();
            const response = await ai.models.generateContent({
                model: "gemma-4-31b-it",
                contents: JSON.stringify(context),
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

    async saveMemory(groupId: Types.ObjectId, memory: CreateMemory, cacheService: CacheService) {
        console.log("Save memory init:", memory)
        if(memory.action !== "create") {
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
            if(result) {
                cacheService.pushMemory(groupId, result)
                if(memory.memory.type === "reminder" && memory.memory.metadata) {
                    try {
                        await Reminder.create({
                            groupId: groupId,
                            memoryId: result._id,
                            remindAt: memory.memory.metadata.remindAt
                        })
                    } catch (error) {
                        console.error("Reminder creation failed:", error);
                    }
                }
            }
    
            return result;
        } catch (error) {
            console.error("Save Memory failed:", error);
            throw error;
        }
    }

    async updateMemory(groupId: Types.ObjectId, memory: UpdateMemory, cacheService: CacheService) {
        console.log("Update memory init:", memory)
        if(memory.action !== "update") {
            return;
        }
        try {
            console.log("Update memory:", memory)
            let existingMemory = await Memories.findById(memory.memoryId)
            if(!existingMemory) {
                return null;
            }

            if(memory.changes.text) {
                const embeddings = await AgentService.generateEmbeddings(memory.changes.text)
                existingMemory.text = memory.changes.text
                existingMemory.embedding = embeddings
            }

            if(memory.changes.confidence) {
                existingMemory.confidence = memory.changes.confidence
            }

            if(memory.changes.metadata) {
                existingMemory.metadata = memory.changes.metadata
            }

            await existingMemory.save()

            cacheService.updateMemory(groupId, memory)

            console.log("Updated memory res:", existingMemory)

            return existingMemory;
        } catch (error) {
            console.error("Update Memory Error:", error)
            return null;
        }
    }

    async deleteMemory(groupId: Types.ObjectId, memory: DeleteMemory, cacheService: CacheService) {
        console.log("Delete memory init:", memory)
        if(memory.action !== "delete") {
            return;
        }
        try {
            console.log("Delete memory:", memory)
            let result = await Memories.findByIdAndDelete(memory.memoryId)
            if(!result) {
                return null;
            }

            console.log("Delete memory res:", result)
            cacheService.deleteMemory(groupId, memory.memoryId)

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

    static async MemoryRetriever(groupId: Types.ObjectId, message: string) {
        console.log("Memory Retriver:", message)
        try {
            const embedding = await AgentService.generateEmbeddings(message)

            const memories = await Memories.aggregate([
                {
                    $vectorSearch: {
                        index: "memory_index",
                        path: "embedding",
                        queryVector: embedding,
                        numCandidates: 100,
                        limit: 10,
                        filter: {
                            groupId: groupId
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
            
            const result = memories
            .filter(m => m.score > 0.75)
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                if (b.confidence !== a.confidence) return b.confidence - a.confidence;
                return b.updatedAt.getTime() - a.updatedAt.getTime();
            })
            .slice(0, 8);
            
            console.log("Memory Retriver Res:", result)

            return result;
        } catch (error) {
            console.error("Memory Retriver Error: ", error)
            return [];
        }
    }

    async decisionAI() {
        console.log("Decision AI Started!")
        try {
            // const recentMessages = await Message.find({ groupId: message.groupId }).sort({ createdAt: -1 }).limit(10).lean()
            const context = this.builder.generateDecisionAI();
            const response = await ai.models.generateContent({
                model: "gemma-4-31b-it",
                contents: JSON.stringify(context),
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

    async replyAI(type: "message" | "reminder", reminder?: IReminder): Promise<string> {
        console.log("Replay AI Started!")
        try {
            // const recentMessages = await Message.find({ groupId: message.groupId }).sort({ createdAt: -1 }).limit(20).lean()
            let context = null;
            if(type === "reminder" && reminder) {
                context = this.builder.generateReplayAI(reminder)
            } else {
                context = this.builder.generateReplayAI()
            }
            const response = await ai.models.generateContent({
                model: "gemma-4-31b-it",
                contents: JSON.stringify(context),
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

    async summaryAI(session: ISession) {
        console.log("Summary AI Started!")
        try {
            const context = await this.builder.generateSummaryAI(session)
            const response = await ai.models.generateContent({
                model: "gemma-4-31b-it",
                contents: JSON.stringify(context),
                config: {
                    systemInstruction: SUMMARY_AI_SYS_PROP,
                    responseMimeType: "application/json"
                }
            })
            console.log("Summary AI Res:", response.text)
    
            return JSON.parse(response.text!);
        } catch (error) {
            console.error("Summary AI Error:", error)
            return null
        }
    }
}

export default AgentService