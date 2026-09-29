import { Request } from 'express';

/** Token from `Authorization: Bearer <token>`, falling back to a `token` field in the body */
export const tokenFromRequest = (req: Request): string | undefined => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim();
  }
  return typeof req.body?.token === 'string' ? req.body.token : undefined;
};
