import { Router } from "express";
import {
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
} from "../controllers/user.controller.js";
import { upload } from "../middleware/multer.middleware.js"
import { verifyJWT } from "../middleware/auth.middleware.js"


const router = Router()

router.route("/register").post(
    upload.fields([   //adding a middleware before registering the user
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser)

router.route("/login").post(loginUser)

//secured routes (access to routes when user is logged in)

router.route("/logout").post(verifyJWT, logoutUser)
//In above line of statement we used two methods which verifyJWT works as middleware which allows us to access new value req.user
//thats why we next() in end of the definition of verifyJWT 

router.route("/refresh-token").post(refreshAccessToken) //we didnt use any middleware like verifyJWT cause we did the decoding code inside that function
router.route("/change-password").post(verifyJWT, changeCurrentPassword)
router.route("/current-user").post(verifyJWT, getCurrentUser)
router.route("/update-account").patch(verifyJWT, updateAccountDetails)

//upload.single("avatar") middleware for uploading files (single for one file)
router.route("/avatar").patch(verifyJWT, upload.single("avatar"), updateUserAvatar)

router.route("/cover-image").patch(verifyJWT, upload.single("coverImage"), updateUserCoverImage)

//after : , treated as params
router.route("/channel/:username").get(verifyJWT, getUserChannelProfile)

router.route("/history").get(verifyJWT, getWatchHistory)

export default router