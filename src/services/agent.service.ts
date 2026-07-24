import Message, { type IMessage } from "../models/Message.js";
import { GoogleGenAI } from "@google/genai";
import { MEMOERY_AI_SYS_PROP } from "../utils/MemoryAISYSPrompt.js";
import Memories, { type IMemories } from "../models/Memories.js";
import { type ISession } from "../models/Session.js";
import { DECISION_AI_SYS_PROP } from "../utils/DecisionAISYSPrompt.js";
import { REPLAY_AI_SYS_PROP } from "../utils/ReplayAISYSPrompt.js";

const ai = new GoogleGenAI({});

class AgentService {
    async memoryAI(message: IMessage) {
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

        if (!response.text) {
            throw new Error("Memory AI returned empty response.");
        }

        const result = JSON.parse(response.text)

        return result;
    }

    async saveMemories(memories: IMemories[]) {
        if (memories.length === 0) {
            return []
        }

        const docs = await Promise.all(
            memories.map(async (memory) => ({
                ...memory,
                embedding: await AgentService.generateEmbeddings(memory.text)
            }))
        );

        return Memories.insertMany(docs);
    }

    static async generateEmbeddings(text: string): Promise<number[]> {
        try {
            const response = await ai.models.embedContent({
                model: 'text-embedding-004',
                contents: text
            })

            const values = response.embeddings?.values?.();
            if (values) {
                return Array.from(values) as number[];
            }
        } catch (error) {
            return []
        }

        return [];
    }

    async MemoryRetriever(message: IMessage) {
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

            return memories;
        } catch (error) {
            console.error(error)
            return null;
        }
    }

    async decisionAI(message: IMessage, session: ISession, memories: IMemories[]) {
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

        return JSON.parse(response.text!);
    }

    async replyAI(
        message: IMessage,
        session: ISession,
        memories: IMemories[]
    ): Promise<string> {
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

        return response.text?.trim() ?? "";
    }
}

export default new AgentService()