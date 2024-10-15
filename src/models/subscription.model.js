import mongoose, { Schema } from "mongoose";

//when someone subscribes someone there would form a document with subscriber and channel field in it
//subscriber is a user and channel is also a user
const subscriptionSchema = new Schema({
    subscriber: {
        type: Schema.Types.ObjectId,  //one who is subscribing
        ref: "User"
    },
    channel: {
        type: Schema.Types.ObjectId,  //one to whom subscriber is subscribing
        ref: "User"
    }
},{ timestamps: true })

export const Subscription = mongoose.model("Subscription", subscriptionSchema)