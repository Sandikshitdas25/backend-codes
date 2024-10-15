import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"
import { json } from "express";
import mongoose from "mongoose";


const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })  //we have to use validateBeforeSave because when we are saving the user fields like passwords get triggered because those are required fields , to avoid those conflicts

        return { accessToken, refreshToken }

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating token")
    }
}

const registerUser = asyncHandler(async (req, res) => {
    //get user details from frontend
    //validation - not empty
    //check if user already exists : username, email
    //check for images , check for avatar
    //upload them to cloudinary
    //check for user creation
    //return

    const { fullName, email, username, password } = req.body

    if ([username, email, fullName, password].some((field) => field.trim() === "")) {
        throw new ApiError(400, "All fields are required")
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "User already exists")
    }

    //hence we used a middleware for uploading files we get access to some functions(req.files) 
    //we used req.files instead of req.file cause we are handling mulitiple files 

    const avatarLocalPath = req.files?.avatar[0]?.path
    // const coverImageLocalPath = req.files?.coverImage[0]?.path  (coverImage was optional but when we dont upload it, we face some error)
    //Its not a logic problem it was a core javascript problem

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }


    //console.log(req.files)
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }

    const user = await User.create({
        username: username.toLowerCase(),
        fullName,
        email,
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || ""

    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"     //In select function we write which ever the elements we dont want with a '-' sign
    )

    if (!createdUser) {
        throw new ApiError(500, "something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )
})

const loginUser = asyncHandler(async (req, res) => {
    //req.body --> user
    //username or email
    //find the user
    //password check
    //access or refresh token
    //send cookie

    const { username, email, password } = req.body
    console.log("req.user: ", req.user)
    if (!username && !email) {
        throw new ApiError(400, "Username or email is required")
    }

    const user = await User.findOne({
        $or: [{ username }, { email }]
    })
    if (!user) {
        throw new ApiError(400, "No user exist")
    }

    //The diff b/w user and User is , user is the instance of User which includes some function like isPasswordCorrect etc which we defined earlier
    const isPasswordValid = await user.isPasswordCorrect(password)
    if (!isPasswordValid) {
        throw new ApiError(401, "Password is incorrect")
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id)

    //we are fetching user for one more time because the user reference we have that does not have refreshToken so we have to and also 
    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    // we dont need some fields like passowords


    //sending and modifying cookies
    const options = {
        httpOnly: true,    //this means  cookie can be change only from server
        secure: true       //cannot be change from frontend
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(200,
                {
                    user: loggedInUser, accessToken, refreshToken
                },
                "User logged in successfully"
            )
        )
})

const logoutUser = asyncHandler(async (req, res) => {
    console.log("req: ", req)
    console.log("req.user: ", req.user)
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {   //operator used for updating 
                refreshToken: undefined
            },
        },
        {
            new: true    //this means the return user will be the updated one
        }
    )

    //sending and modifying cookies
    const options = {
        httpOnly: true,    //this means  cookie can be change only from server
        secure: true       //cannot be change from frontend
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User loggedOut "))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized access")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET
        ) //decodedToken will hold the values we defined earlier in user model

        const user = await User.findOne(decodedToken?._id)
        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }

        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expires or used")
        }

        const options = {
            httpOnly: true,
            secure: true
        }

        const { newAccessToken, newRefreshToken } = await generateAccessAndRefreshToken(user._id)

        return res
            .status(200)
            .cookie("accessToken", newAccessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    {
                        accessToken: newAccessToken,
                        refreshToken: newRefreshToken
                    },
                    "Access token refreshed"
                )
            )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }
})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    //If the user is able to change password the user is logged in
    // so we can get his id from cookies and middleware
    const { oldPassword, newPassword } = req.body

    const user = await User.findById(req.user._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid password")
    }

    user.password = newPassword
    await user.save({ validateBeforeSave: false })

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password changed successfully"))
})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponse(200, req.user, "Current user fetched successfully"))
})

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body
    
    if(!fullName || !email){
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,   
                email: email   //both the line means the same
            }
        },
        { new: true}  //new: true means it will return the updated user which stored in user var
    ).select("-password")  //.select("-password") means give the updated user with no password field in it

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    //here we are using req.file cause we are handling one file at a time only
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400, "Error while uploading avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {
            new: true
        }
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Avatar updated successfully")
    )
})

const updateUserCoverImage = asyncHandler(async (req, res) => {
    //here we are using req.file cause we are handling one file at a time only
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400, "Cover image file is required")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400, "Error while uploading cover image")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        {
            new: true
        }
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Cover image updated successfully")
    )
})

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params

    if(!username?.trim){
        throw new ApiError(400, "Username is missing")
    }

    //applying aggregation pipeline, it returns array
    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()   //finding the user with username
            }
        },
        {
            $lookup: {
                from: "subscriptions", //Users save as collection name users such that
                localField: "_id",
                foreignField: "channel",  //when someone subscribes someone there would 
                as: "subscribers" //form a document with subscriber and channel field in it
            }
        },
        {
            $lookup: {
                from: "subscriptions", //Users save as collection name users such that
                localField: "_id",  
                foreignField: "subscriber",//when someone subscribes someone there 
                as: "subscribedTo"  //would form a document with subscriber and channel field in it
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                email: 1,
                subscribersCount: 1,
                channelSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
            }
        }
    ])

    // console.log(channel)
    if(!channel?.length){
        throw new ApiError(404, "Channel does not exist")
    }

    //channel will be in the form of array so channel[0]
    return res
    .status(200)
    json(new ApiResponse(200, channel[0], "Channel fetched successfully"))
})

const getWatchHistory = asyncHandler(async(req, res) => {
    //mongoose save the id of the document as _id: ObjectId("idstring")
    //In mongoDb pipeline there is no contribution of mongoose so

    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",  //videoSchema which save as videos
                localField: "watchHistory",    //lookup used for to find videos watched 
                foreignField: "_id",           //by user
                as: "watchHistory",
                pipeline: [      //subpipeline used for nested lookup 
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner", //lookup used for finding the owner 
                            foreignField: "_id", //the video
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {  //all the files will be in owner field
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        },
                    },
                    {
                        $addFields: {  //aggregation returns array value
                            owner: {   // all the values present in owner field so
                                $first: "$owner"  //we passed the value as first element
                            }          //for easier access in frontend  
                        }       
                    }
                ]

            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200, 
            user[0].watchHistory, 
            "Watch history fetched successfully"
        )
    )
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}