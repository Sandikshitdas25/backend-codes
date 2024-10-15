// require('dotenv').config({path: './env'}) 
// above statement is wrong approach cause it using commonjs syntax

//correct one 
import connectDB from "./db/index.js";
import {app} from './app.js'
import dotenv from "dotenv"
dotenv.config({
    path: "./env"
})
//to use this one we have to make some changes in package.json file
//write -r dotenv/config --experimental-json-modules between nodemon/node and file_name

// import connectDB from "./db";
//above statement will give error because we have define the file name properly


connectDB()  // it returns a promise so writing then() and catch() block
.then(() => {
    app.listen(process.env.PORT || 8000, () => {
        console.log(`⚙️ Server is running at port : ${process.env.PORT}`);
    })
})
.catch((err) => {
    console.log("MONGO db connection failed !!! ", err);
})

