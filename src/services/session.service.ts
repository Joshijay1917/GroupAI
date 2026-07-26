import Group from "../models/Group.js";
import { type IMessage } from "../models/Message.js"
import Session from "../models/Session.js"
import type AgentService from "./agent.service.js";

const MINUTE = 60 * 1000;
const SESSION_TIMEOUT = 30 * MINUTE;

class SessionService {
    async manage(message: IMessage, agent: AgentService) {
        const session = await Session.findOne({
            groupId: message.groupId,
            status: "active"
        });

        if(!session) {
            const newSession = await Session.create({
                groupId: message.groupId,
                title: "New Conversation",
                participants: [message.senderId._id],
                messageIds: [message._id]
            })
            return newSession;
        }

        const current = Date.now()
        const last = session.lastActivityAt.getTime();
        const diff = current - last;

        if(diff > SESSION_TIMEOUT) {
            const sessionSummary = await agent.summaryAI(session)
            if(sessionSummary) {
                session.title = sessionSummary.title;
                session.summary = sessionSummary.summary
            }
            session.status = "closed"
            await session.save()

            const newSession = await Session.create({
                groupId: message.groupId,
                title: "New Conversation",
                participants: [message.senderId._id],
                messageIds: [message._id]
            })
            return newSession;
        }

        session.messageIds.push(message._id);

        if (!session.participants.includes(message.senderId._id)) {
            session.participants.push(message.senderId._id);
        }

        session.lastActivityAt = new Date();

        await session.save();

        return session;
    }
}

export default new SessionService()