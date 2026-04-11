import { Router } from "express";
import multer from "multer";
import { protect, restrictTo } from "../../middleware/auth.middleware";
import { createDesignSubmission, getMySubmissions, getMySubmissionById } from "../../controller/design/design-submission.controller";

const router = Router();

// Configure multer for file uploads using memory storage for Supabase
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(null, false);
      return cb(new Error("Only pdf, png, jpg, jpeg files are allowed"));
    }
  },
});

// Client routes: Allow clients to submit their custom designs, list their own submissions, and view specific submission details
router.post("/", protect, restrictTo("CLIENT"), upload.single("file"), createDesignSubmission);
router.get("/my", protect, restrictTo("CLIENT"), getMySubmissions);
router.get("/my/:submissionId", protect, restrictTo("CLIENT"), getMySubmissionById);

// Note: Admin routes will be configured separately or within this file
export default router;
