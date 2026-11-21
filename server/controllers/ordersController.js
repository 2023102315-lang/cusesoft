import {
  confirmOrder,
  createOrder,
  getOrderForUser,
  listMyOrders,
  resolveDownload,
} from '../orders.js';

export async function create(req, res) {
  const result = await createOrder(req.user, req.body?.items);
  res.status(201).json(result);
}

export async function listMine(req, res) {
  res.json({ orders: await listMyOrders(req.user.id) });
}

export async function getById(req, res) {
  res.json(await getOrderForUser(req.user.id, req.params.id));
}

export async function confirm(req, res) {
  const result = await confirmOrder(req.user, req.params.id, req.body?.operationCode);
  res.json(result);
}

export function download(req, res, next) {
  let file;
  try {
    file = resolveDownload(req.params.token);
  } catch (error) {
    return next(error);
  }
  res.setHeader('Cache-Control', 'no-store');
  return res.download(file.filePath, file.product.fileName, (error) => {
    if (error && !res.headersSent) next(error);
  });
}
