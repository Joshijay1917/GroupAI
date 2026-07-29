import express, { type NextFunction, type Request, type Response } from "express"
import whatsAppRouter from "./routes/whatsapp.route.js"
import cors from "cors"
import path from "node:path";
import userRouter from "./routes/user.route.js";
import groupRouter from "./routes/group.route.js";
import { io } from "./index.js";

const app: any = express();

app.use(express.json());
app.use(cors())
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(import.meta.dirname, 'public')))
app.use((req: Request, res: Response, next: NextFunction) => {
    req.io = io;
    next();
});

app.get('/', (req: Request, res: Response) => {
    return res.sendFile(path.join(import.meta.dirname, 'public', 'index.html'))
})

app.use('/api/v1/whatsapp', whatsAppRouter)
app.use('/api/v1/users', userRouter)
app.use('/api/v1/groups', groupRouter)

export default app