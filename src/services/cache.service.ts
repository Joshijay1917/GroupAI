import type { Types } from "mongoose";
import type { IMessage } from "../models/Message.js";
import type { ISession } from "../models/Session.js";
import type { IMemories } from "../models/Memories.js";

interface CurrentMessage {
    sender: Types.ObjectId,
    text: string,
    createdAt: Date
}

interface RecentMessage {
    sender: Types.ObjectId;
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
    currentMessage?: CurrentMessage,
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

    init(message: IMessage, recentMessages: IMessage[], sessions: ISession[], memories: IMemories[]) {
        const groupId = message.groupId.toString();
        let cacheGroup = this.cache.get(groupId)
        if(!cacheGroup) {
            cacheGroup = {
                recentMessages: [],
                sessions: [],
                memories: []
            };

            this.cache.set(groupId, cacheGroup)
        }

        cacheGroup.currentMessage = {
            sender: message.senderId,
            text: message.text,
            createdAt: message.createdAt
        };

        cacheGroup.recentMessages = recentMessages.map(m => ({
            sender: m.senderId,
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
        
        return cacheGroup;
    }

    setCurrentMessage(message: IMessage) {
        const group = this.get(message.groupId.toString());

        group.currentMessage = {
            sender: message.senderId,
            text: message.text,
            createdAt: message.createdAt
        };
    }

    pushRecentMessage(message: IMessage) {
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

    getGroup(groupId: Types.ObjectId) {
        return this.get(groupId.toString());
    }

    clear(groupId: Types.ObjectId) {
        this.cache.delete(groupId.toString());
    }
}