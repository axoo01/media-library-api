import { Router } from 'express';
import * as mediaController from '../controllers/mediaController.js';
import catchAsync from '../utils/catchAsync.js';
import validate from '../middlewares/validate.js';
import { uploadMany, uploadSingle } from '../middlewares/upload.js';
import {
  bulkCreateMediaSchema,
  createMediaSchema,
  listMediaSchema,
  mediaIdSchema,
  updateMediaSchema,
} from '../validators/mediaValidator.js';

const router = Router();

// Multer must run before validate(): multipart fields and files don't exist until it parses the body.
router
  .route('/')
  .get(validate(listMediaSchema), catchAsync(mediaController.getAll))
  .post(uploadSingle, validate(createMediaSchema), catchAsync(mediaController.create));

router.post(
  '/bulk',
  uploadMany,
  validate(bulkCreateMediaSchema),
  catchAsync(mediaController.createBulk),
);

router
  .route('/:id')
  .get(validate(mediaIdSchema), catchAsync(mediaController.getById))
  .put(validate(updateMediaSchema), catchAsync(mediaController.update))
  .delete(validate(mediaIdSchema), catchAsync(mediaController.remove));

export default router;
