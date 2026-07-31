import User, { type IUser } from "../models/User.js";
import Message, { type IMessage } from "../models/Message.js"
import { CacheService, type GroupCache } from "./cache.service.js";
import type { Types } from "mongoose";

const WAHA_API_URL = process.env.WAHA_API_URL || "http://localhost:3001"
const WAHA_API_KEY = process.env.WAHA_API_KEY
if(!WAHA_API_KEY) {
    console.warn("WAHA_API_KEY Not Found in ENV! cannot send message!")
}

interface StoreMessageOptions {
    senderId: Types.ObjectId;
    receiverId: Types.ObjectId;
    groupId: Types.ObjectId;
    text: string;
    aiGenerated: boolean;
}

export interface StorePayload {
    participant: string;
    body: string;
}

const senderIdMapper = new Map()
const receiverIdMapper = new Map()

export class MessageService {
    private cacheService: CacheService;

    constructor(cache: CacheService) {
        this.cacheService = cache
    }

    async storeMessage(message: StoreMessageOptions) {
        try {
            const messageDoc = await Message.create({
                senderId: message.senderId,
                receiverId: message.receiverId,
                text: message.text,
                aiGenerated: message.aiGenerated,
                groupId: message.groupId
            })
            
            await messageDoc.populate<{ "senderId": IUser }>("senderId")

            this.cacheService.pushRecentMessage(messageDoc)

            return messageDoc;
        } catch (error) {
            console.error("MessageService: Failed to store message in db:", error)
            throw error
        }
    }

    async handleUserMessage(payload: StorePayload, receiverId: string) {
        const sender = payload.participant;
        const receiver = receiverId;
        const text = payload.body;
        console.log("Message send by ", sender, " To the ", receiver, " MSG:", text)

        let senderUser = senderIdMapper.get(sender)
        if(!senderUser) {
            senderUser = await User.findOne({ whatsappUserId: sender })
            if(senderUser) {
                senderIdMapper.set(sender, senderUser)
            }
        }
        let receiverUser = receiverIdMapper.get(receiver)
        if(!receiverUser) {
            receiverUser = await User.findOne({ whatsappUserId: receiver })
            if(receiverUser) {
                receiverIdMapper.set(receiver, receiverUser)
            }
        }

        if(!senderUser || !receiverUser) {
            throw new Error("User does not exists!")
        }

        const aiGenerated = senderUser.isBot

        const message = await this.storeMessage({
            senderId: senderUser._id,
            receiverId: receiverUser._id,
            text: text,
            aiGenerated: aiGenerated,
            groupId: senderUser.groupId
        })

        return message
    }

    async storeAIMessage(groupId: Types.ObjectId, text: string) {
        const bot = await User.findOne({
            groupId: groupId.toString(),
            isBot: true
        })

        if(!bot) {
            throw new Error("Bot user not found!")
        }

        const message = await this.storeMessage({
            senderId: bot._id,
            receiverId: bot._id,
            text: text,
            aiGenerated: true,
            groupId: groupId
        })

        return message
    }

    async sendReplay(groupId: string, text: string) {
        try {
            // const receiverUser = senderIdMapper.get(groupId)
            const res = await fetch(`${WAHA_API_URL}/api/sendText`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Api-Key": process.env.WAHA_API_KEY || ''
                },
                body: JSON.stringify({
                    chatId: groupId,
                    text: text,
                    session: "default"
                }),
            })

            if(!res.ok) {
                throw new Error("Failed to send message!")
            }
        } catch (error: any) {
            console.error(error)
            throw error
        }
    }

    async startTyping(chatId: string) {
        await fetch(`${WAHA_API_URL}/api/startTyping`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Api-Key": WAHA_API_KEY || ""
            },
            body: JSON.stringify({
                session: "default",
                chatId
            })
        });
    }

    async stopTyping(chatId: string) {
        await fetch(`${WAHA_API_URL}/api/stopTyping`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Api-Key": WAHA_API_KEY || ""
            },
            body: JSON.stringify({
                session: "default",
                chatId
            })
        });
    }
}