export class AppError extends Error {
  constructor(status, message, errors) { super(message); this.status = status; this.errors = errors; }
}
export const ok = (res, data = null, status = 200) => res.status(status).json({ success: true, data });
export const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export const pageOf = (req, max = 100) => {
  const page = Math.max(1, parseInt(req.query.page) || 1), limit = Math.min(max, Math.max(1, parseInt(req.query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit, take: limit };
};
export const paged = (items, total, p) => ({ items, total, page: p.page, pages: Math.max(1, Math.ceil(total / p.limit)) });
