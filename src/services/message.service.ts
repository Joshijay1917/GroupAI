import User from "../models/User.js";
import Message, { type IMessage } from "../models/Message.js"

const WAHA_API_URL = process.env.WAHA_API_URL || "http://localhost:3001"
const WAHA_API_KEY = process.env.WAHA_API_KEY
if(!WAHA_API_KEY) {
    console.warn("WAHA_API_KEY Not Found in ENV! cannot send message!")
}

export interface StorePayload {
    from: string;
    to: string;
    body: string;
}

const senderIdMapper = new Map()
const receiverIdMapper = new Map()

class MessageService {
    async store(payload: StorePayload, receiverId: string) {
        const sender = payload.from;
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

        console.log("MessageService SenderUser: ", senderUser, " ReceiverUser: ", receiverUser)

        if(!senderUser || !receiverUser) {
            throw new Error("User does not exists!")
        }

        const aiGenerated = senderUser.isBot

        const message = await Message.create({
            senderId: senderUser._id,
            receiverId: receiverUser._id,
            text,
            aiGenerated,
            groupId: senderUser.gropuId
        })

        return message
    }

    async sendReplay(receiver: string, text: string) {
        try {
            const receiverUser = senderIdMapper.get(receiver)
            const res = await fetch(`${WAHA_API_URL}/api/sendText`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Api-Key": process.env.WAHA_API_KEY || ''
                },
                body: JSON.stringify({
                    chatId: receiverUser.whatsappUserId,
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
}

export default new MessageService()