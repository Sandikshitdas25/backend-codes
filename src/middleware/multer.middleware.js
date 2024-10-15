import multer from "multer";

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "./public/temp")
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname)  //uploading the same file same as user has given
    }
  })
  
export const upload = multer({ storage: storage })