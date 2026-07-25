import Group from "../models/Group.js";
import { type IMessage } from "../models/Message.js"
import Session from "../models/Session.js"

const MINUTE = 60 * 1000;
const SESSION_TIMEOUT = 30 * MINUTE;

class SessionService {
    async manage(message: IMessage) {
        const session = await Session.findOne({
            groupId: message.groupId,
            status: "active"
        });

        if(!session) {
            const newSession = await Session.create({
                groupId: message.groupId,
                title: "New Conversation",
                participants: [message.senderId],
                messageIds: [message._id]
            })
            return newSession;
        }

        const current = Date.now()
        const last = session.lastActivityAt.getTime();
        const diff = current - last;

        if(diff > SESSION_TIMEOUT) {
            session.status = "closed"
            await session.save()

            const newSession = await Session.create({
                groupId: message.groupId,
                title: "New Conversation",
                participants: [message.senderId],
                messageIds: [message._id]
            })
            return newSession;
        }

        session.messageIds.push(message._id);

        if (!session.participants.includes(message.senderId)) {
            session.participants.push(message.senderId);
        }

        session.lastActivityAt = new Date();

        await session.save();

        return session;
    }
}

export default new SessionService()