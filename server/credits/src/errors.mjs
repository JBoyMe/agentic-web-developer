export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) => new HttpError(400, "bad_request", message, details);
export const unauthorized = (message = "A valid license key is required") =>
  new HttpError(401, "unauthorized", message);
export const forbidden = (message = "Not allowed") => new HttpError(403, "forbidden", message);
export const notFound = (message = "Not found") => new HttpError(404, "not_found", message);
export const conflict = (message, details) => new HttpError(409, "conflict", message, details);
export const paymentRequired = (message, details) => new HttpError(402, "payment_required", message, details);
export const upstream = (message, details) => new HttpError(502, "upstream_error", message, details);
export const unavailable = (message, details) => new HttpError(503, "unavailable", message, details);
