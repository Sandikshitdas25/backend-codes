import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

//cookieParser is use for to access or to set the cookies in user's browser from our server(or to perform CRUD operations)

const app = express()

app.use(cors({
    origin: process.env.CORS_ORIGIN, //CORS_ORIGIN=* allowing request irrespective of place
    credentials: true
}))

app.use(express.json({limit: "16kb"})) //allowing json file with a limit

app.use(express.urlencoded({extended: true, limit: "16kb"})) 
//urlencoded use for decoding the url example like spaces are replaced with %20
//extended use for nested object (not necessary)

app.use(express.static("public")) //any images videos that are coming are stored at public file(public is a file name which can be any), which made file accessible from anywhere

app.use(cookieParser())   //using this middleware we gave access to cookies which is used in auth.middleware.js

//routes import 
import userRouter from "./routes/user.routes.js"

//routes declaration (If we didn't have imported the router in above statement we had to use get methods but hence we imported we are using middleware)
app.use("/api/v1/users", userRouter)
// http://localhost:3000/api/v1/users/register (how it will look like)

export { app }
