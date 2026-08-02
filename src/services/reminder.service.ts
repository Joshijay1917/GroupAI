import type { IGroup } from "../models/Group.js";
import Group from "../models/Group.js";
import Memories, { type IMemories } from "../models/Memories.js";
import Reminder, { type IReminder } from "../models/Reminder.js";
import { ContextBuilder } from "../utils/ContextBuilder.js";
import AgentService from "./agent.service.js";
import type { CacheService } from "./cache.service.js";
import { MessageService } from "./message.service.js";

const CHECK_INTERVAL = 30 * 1000;

export class ReminderService {
    private cache: CacheService;
    private messageService: MessageService;
    private timer: NodeJS.Timeout | null = null;
    private running = false;

    constructor(cache: CacheService) {
        this.cache = cache;
        this.messageService = new MessageService(cache)
    }
    
    public start() {
        if (this.timer || this.running) return;

        this.running = true;

        try {
            this.timer = setInterval(() => {
                void this.tick();
            }, CHECK_INTERVAL);
        } catch (error) {
            console.error(error)
        } finally {
            this.running = false
        }
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
                try {
                    console.log("Processing reminder:", reminder)
                    await this.process(reminder);
                } catch (err) {
                    console.error(err);
                }
            }
        }

        const tomorrowStart = new Date();
        tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);
        tomorrowStart.setUTCHours(0, 0, 0, 0);

        const tomorrowEnd = new Date(tomorrowStart);
        tomorrowEnd.setUTCDate(tomorrowEnd.getUTCDate() + 1);

        const plannerReminders = await Reminder.exists({
            status: "pending",
            origin: "system",
            remindAt: { $gte: tomorrowStart, $lt: tomorrowEnd }
        });
        console.log("Start: ", tomorrowStart, "End: ", tomorrowEnd, " Planner reminders for tomorrow:", plannerReminders)

        if(!plannerReminders) {
            try {
                console.log("Creating Daily reminder planner for tomorrow:", tomorrowStart, tomorrowEnd)
                await this.createTomorrowReminder();
            } catch (error) {
                console.error("Create Daily reminder planner:", error);
            }
        } else {
            console.log("Start: ", tomorrowStart, "End: ", tomorrowEnd, " Planner reminders for tomorrow already exist.");
            return;
        }
    }

    private async process(reminder: IReminder) {
        const reminderDoc = await reminder.populate<{ "groupId": IGroup, "memoryId": IMemories }>([ { path: "groupId" }, { path: "memoryId" } ])

        if(!reminderDoc.memoryId) {
            reminder.status = "cancelled";
            await reminder.save();
            return;
        }
        
        try {
            const builder = await ContextBuilder.build(reminderDoc.groupId._id, reminderDoc.memoryId.text, this.cache)
            const agent = new AgentService(builder)
            const replay = await agent.replyAI("reminder", reminderDoc)
            await this.messageService.sendReplay(reminderDoc.groupId.whatsappUserId, replay)
            const message = await this.messageService.storeAIMessage(reminderDoc.groupId._id, replay)

            reminder.status = "sent";
            await reminder.save();

            if(
                reminderDoc.memoryId.type === "reminder" &&
                reminderDoc.memoryId.metadata?.repeat === "daily"
            ) {
                await Memories.findByIdAndUpdate(reminderDoc.memoryId._id)
                this.cache.deleteMemory(reminderDoc.groupId._id, reminderDoc.memoryId._id.toString())
            }

            return message
        } catch (error) {
            console.error("Reminder ReplayAI Error:", error)
        }
    }

    private async createTomorrowReminder() {
        console.log("Create Tomorrow Reminder Planner!")
        const groups = await Group.find({}, "_id");
        
        for(const group of groups) {
            try {
                const builder = await ContextBuilder.build(group._id, "reminder", this.cache)
                const agent = new AgentService(builder);
                let hasRead = false;

                while(true) {
                    const result = await agent.memoryAI("daily_followup", {
                        sender: "system",
                        type: "daily_followup"
                    })

                    if(result && result.actions && result.actions.length > 0) {
                        let shouldContinue = false;
                        for(const a of result.actions) {
                            switch(a.action) {
                                case "create":
                                    await agent.saveMemory(group._id, "message", a, this.cache)
                                    break;
                                case "update":
                                    await agent.updateMemory(group._id, a, this.cache)
                                    break;
                                case "delete":
                                    await agent.deleteMemory(group._id, a, this.cache)
                                    break;
                                case "read":
                                    if(hasRead) {
                                        throw new Error("MemoryAI requested read twice.")
                                    }
                                    const query = a.query
                                    const result = await AgentService.MemoryRetriever(group._id, query ? query : "Reminder")
                                    this.cache.setMemories(group._id, result)
                                    hasRead = true;
                                    shouldContinue = true;
                                    break;
                                default:
                                    break;
                            }
                        }
                        if(!shouldContinue) {
                            break;
                        }
                    }
                }
            } catch (error) {
                console.error("Daily reminder planner:", group._id, error);
            }
        }
    }
}