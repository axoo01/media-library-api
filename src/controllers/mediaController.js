import * as mediaService from '../services/mediaService.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const create = async (req, res) => {
  const { body, file } = req.validated;
  const media = await mediaService.createMedia(file, body);
  sendSuccess(res, { media }, 201);
};

export const createBulk = async (req, res) => {
  const { body, files } = req.validated;
  const results = await mediaService.createMediaBatch(files, body);
  sendSuccess(res, { results, count: results.length }, 201);
};

export const getAll = async (req, res) => {
  const data = await mediaService.listMedia(req.validated.query);
  sendSuccess(res, data);
};

export const getById = async (req, res) => {
  const media = await mediaService.getMediaById(req.validated.params.id);
  sendSuccess(res, { media });
};

export const update = async (req, res) => {
  const { params, body } = req.validated;
  const media = await mediaService.updateMedia(params.id, body);
  sendSuccess(res, { media });
};

export const remove = async (req, res) => {
  await mediaService.deleteMedia(req.validated.params.id);
  sendSuccess(res, null);
};
