import { randomUUID } from 'node:crypto';
import multer from 'multer';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import logger from '../utils/logger.js';
import { UPLOAD_DIR } from '../config/storage.js';
import * as fileRepository from '../repositories/fileRepository.js';
import {
  ALLOWED_FILE_TYPES,
  ALLOWED_MIME_TYPES,
  MAX_BULK_FILES,
  MAX_FILE_SIZE,
} from '../models/Media.js';

const unsupportedFileType = (field, message) =>
  AppError.badRequest('Unsupported file type', [{ field, message }]);

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  // The client's originalname is never used on disk: it enables path traversal and collisions.
  filename: (_req, file, cb) =>
    cb(null, `${randomUUID()}${ALLOWED_FILE_TYPES[file.mimetype].extension}`),
});

const fileFilter = (_req, file, cb) => {
  // Object.hasOwn so a spoofed type like "constructor" can't match an inherited property.
  if (Object.hasOwn(ALLOWED_FILE_TYPES, file.mimetype)) return cb(null, true);
  return cb(
    unsupportedFileType(file.fieldname, `Only ${ALLOWED_MIME_TYPES.join(', ')} files are allowed`),
  );
};

const multerUpload = multer({
  storage,
  fileFilter,
  defParamCharset: 'utf8',
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_BULK_FILES, fields: 10, fieldSize: 10 * 1024 },
});

// Multer leaves path-less placeholders in req.files when it aborts (it removes those files itself).
const collectUploadedFiles = (req) => [req.file, ...(req.files ?? [])].filter((f) => f?.path);

// fileFilter only sees the client-declared MIME type; the magic bytes prove the actual content.
const verifyFileSignatures = catchAsync(async (req, _res, next) => {
  for (const file of collectUploadedFiles(req)) {
    const { signature } = ALLOWED_FILE_TYPES[file.mimetype];
    const header = await fileRepository.readFileHeader(file.path, signature.length);

    if (!signature.every((byte, i) => header[i] === byte)) {
      throw unsupportedFileType(
        file.fieldname,
        `File content does not match its declared type (${file.mimetype})`,
      );
    }
  }
  next();
});

export const uploadSingle = [multerUpload.single('file'), verifyFileSignatures];
export const uploadMany = [multerUpload.array('files', MAX_BULK_FILES), verifyFileSignatures];

// Multer writes files before validation and business logic run, so a failed request must remove them.
export const cleanupUploadedFiles = async (req) => {
  const files = collectUploadedFiles(req);
  if (files.length === 0) return;

  const results = await Promise.allSettled(files.map((f) => fileRepository.removeFile(f.path)));
  const failed = results.filter((r) => r.status === 'rejected');

  failed.forEach((r) => logger.error('Failed to remove orphaned upload', r.reason));
  logger.debug(`Removed ${files.length - failed.length} orphaned upload(s)`);
};
