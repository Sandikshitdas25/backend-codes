import mongoose, {Schema} from "mongoose";
//if we dont import {Schema}, we have to write mongoose.Schema({}) otherwise only schema
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"  //jwts are bearer token which acts like key

const userSchema = new Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true //Important for search functionality
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        fullName: {
            type: String,
            required: true,
            trim: true,
            index: true
        },
        avatar: {
            type: String, //cloudinary url
            required: true
        },
        coverImage: {
            type: String
        },
        watchHistory: [
            {
                type: Schema.Types.ObjectId,
                ref: "Video"
            }
        ],
        password: {
            type: String,
            required: [true, "Password is required"]
        },
        refreshToken: {
            type: String
        }
    },
    {
        timestamps: true
    }
)

userSchema.pre("save", async function (next){
    if(this.isModified("password")){   
        this.password = await bcrypt.hash(this.password, 10)
        next()
    }

    //if we dont use this isModified function that it will update or hash the password everytime someone changes other credentials also
}) 

//checking if the password is correct or not implementing some methods
userSchema.methods.isPasswordCorrect = async function (password){
    return await bcrypt.compare(password, this.password)
}

userSchema.methods.generateAccessToken = function(){
    return jwt.sign(   //sign function creates jwt token
        {
            _id: this._id,
            username: this.username,
            email: this.email,
            fullName: this.fullName
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}

userSchema.methods.generateRefreshToken = function (){
    return jwt.sign(   //sign function creates jwt token
        {
            _id: this._id,      //refreshToken holds less information  
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

//arrow function should not be used in this type of case
export const User = mongoose.model("User", userSchema)