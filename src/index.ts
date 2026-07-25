import app from "./app.js"
import { connectToDatabase } from "./config/database.js"

const PORT = 3000

connectToDatabase();

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})