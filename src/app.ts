import express from "express"
import whatsAppRouter from "./routes/whatsapp.route.js"

const app: any = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/v1/whatsapp', whatsAppRouter)

export default app