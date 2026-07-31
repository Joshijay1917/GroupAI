import type { Types } from "mongoose";
import type { IMessage } from "../models/Message.js";
import type { ISession } from "../models/Session.js";
import type { IMemories } from "../models/Memories.js";
import type { IUser } from "../models/User.js";
import type { UpdateMemory } from "../types/Memory/update.js";

interface CurrentMessage {
    sender: Types.ObjectId,
    text: string,
    createdAt: Date
}

interface RecentMessage {
    sender: any;
    text: string;
    createdAt: Date;
    aiGenerated: boolean;
}

export interface SessionCache {
    title: string;
    summary?: string | undefined;
    participants: Types.ObjectId[];
    lastActivityAt: Date;
}

export interface MemoryCache {
    id: Types.ObjectId;
    type: IMemories["type"];
    text: string;
    confidence: number;
    metadata?: Record<string, any> | undefined;
}

export interface GroupCache {
    recentMessages: RecentMessage[];
    sessions: SessionCache[];
    memories: MemoryCache[];
}

export class CacheService {
    private cache = new Map<string, GroupCache>();

    private get(groupId: string) {
        if(!this.cache.has(groupId)) {
            this.cache.set(groupId, {
                recentMessages: [],
                sessions: [],
                memories: []
            })
        }

        return this.cache.get(groupId)!;
    }

    init(currentGroupId: Types.ObjectId, recentMessages: IMessage[], sessions: ISession[], memories: IMemories[]) {
        console.log("Cache Service Init!")
        const groupId = currentGroupId.toString()
        let cacheGroup = this.cache.get(groupId)
        if(!cacheGroup) {
            cacheGroup = {
                recentMessages: [],
                sessions: [],
                memories: []
            };

            this.cache.set(groupId, cacheGroup)
        }

        cacheGroup.recentMessages = recentMessages.map(m => ({
            sender: {...m.senderId},
            text: m.text,
            aiGenerated: m.aiGenerated,
            createdAt: m.createdAt
        }));
        cacheGroup.sessions = sessions;
        cacheGroup.memories = memories.map(m => ({
            id: m._id,
            type: m.type,
            text: m.text,
            metadata: m.metadata,
            confidence: m.confidence
        }));

        console.log("Initialized Cache Service!:", cacheGroup)
        
        return cacheGroup;
    }

    pushRecentMessage(message: IMessage) {
        console.log("Cache Service Push Recent Message:", message)
        const group = this.get(message.groupId.toString());

        group.recentMessages.push({
            sender: message.senderId,
            text: message.text,
            createdAt: message.createdAt,
            aiGenerated: message.aiGenerated
        });

        if (group.recentMessages.length > 50) {
            group.recentMessages.shift();
        }
    }

    setSessions(groupId: Types.ObjectId, sessions: ISession[]) {
        console.log("Cache Service Set Session:", sessions)
        const group = this.get(groupId.toString());

        group.sessions = sessions
            .slice(-2)
            .map(s => ({
                title: s.title,
                summary: s.summary ? s.summary : undefined,
                participants: s.participants,
                lastActivityAt: s.lastActivityAt
            }));
    }

    updateLastSession(groupId: Types.ObjectId) {
        console.log("Cache Service UpdateLastSess")
        const group = this.get(groupId.toString());
        const lastSession = group.sessions.at(-1);

        if (!lastSession) return;

        lastSession.lastActivityAt = new Date();
    }

    setMemories(groupId: Types.ObjectId, memories: IMemories[]) {
        const group = this.get(groupId.toString());

        group.memories = memories.map(m => ({
            id: m._id,
            type: m.type,
            text: m.text,
            confidence: m.confidence,
            metadata: m.metadata
        }));
    }

    pushMemory(groupId: Types.ObjectId, memory: IMemories) {
        console.log("Cache Service PushMemo:", memory)
        const group = this.get(groupId.toString());

        group.memories.push({
            id: memory._id,
            type: memory.type,
            text: memory.text,
            confidence: memory.confidence,
            metadata: memory.metadata
        })
    }

    updateMemory(groupId: Types.ObjectId, memory: UpdateMemory) {
        console.log("Cache Service Update Memory:", memory)
        const group = this.get(groupId.toString());

        const currentMemory = group.memories.find(m => m.id.toString() === memory.memoryId.toString())
        if(currentMemory) {
            currentMemory.text = memory.changes.text;
            currentMemory.confidence = memory.changes.confidence;
            currentMemory.metadata = memory.changes.metadata;
        }

        return currentMemory;
    }

    deleteMemory(groupId: Types.ObjectId, memoryId: string) {
        console.log("Cache Service Delete Memory:", memoryId)
        if(!memoryId) return;
        const group = this.get(groupId.toString());

        group.memories = group.memories.filter(m => m.id.toString() !== memoryId.toString())
    }

    getGroup(groupId: Types.ObjectId) {
        return this.get(groupId.toString());
    }

    clear(groupId: Types.ObjectId) {
        this.cache.delete(groupId.toString());
    }
}