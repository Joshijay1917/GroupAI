import type { IGroup } from "../models/Group.js";
import Memories, { type IMemories } from "../models/Memories.js";
import Reminder, { type IReminder } from "../models/Reminder.js";
import type AgentService from "./agent.service.js";
import type { CacheService, GroupCache } from "./cache.service.js";
import messageService, { type StorePayload } from "./message.service.js";

const CHECK_INTERVAL = 30 * 1000;

export class ReminderService {
    private cache: CacheService;
    private agent: AgentService;
    private payload: StorePayload;
    private receiverId: string;

    constructor(cache: CacheService, agent: AgentService, payload: StorePayload, receiverId: string) {
        this.cache = cache
        this.agent = agent
        this.payload = payload
        this.receiverId = receiverId
    }
    
    public start() {
        setInterval(() => {
            void this.tick();
        }, CHECK_INTERVAL);
    }

    private async tick() {
        console.log("Reminder service tick!")
        const reminders = await Reminder.find({
            status: "pending",
            remindAt: { $lte: new Date() }
        });
        console.log("Reminder service res:", reminders)

        if(reminders && reminders.length > 0) {
            for(const reminder of reminders) {
                await this.process(reminder)
            }
        }
    }

    private async process(reminder: IReminder) {
        // const memory = await Memories.findById(reminder.memoryId).populate<{ "groupId": IGroup }>("groupId")
        const reminderDoc = await reminder.populate<{ "groupId": IGroup, "memoryId": IMemories }>("groupId", "memoryId")

        if(!reminderDoc.memoryId) {
            reminder.status = "cancelled";
            await reminder.save();
            return;
        }
        
        try {
            const replay = await this.agent.replyAI("reminder", reminderDoc)
            await messageService.sendReplay(reminderDoc.groupId.whatsappUserId, replay)
            const message = await messageService.storeAIMessage(this.payload, this.receiverId, replay, this.cache)
        } catch (error) {
            console.error("Reminder ReplayAI Error:", error)
        }
    }
}