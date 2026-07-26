import type { IMessage } from "../../models/Message.ts"
import type { ISession } from "../../models/Session.ts"

export type SummaryAI = {
    session: ISession,
    messages: Partial<IMessage>[]
}