export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message || code || `HTTP ${status}`);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static async fromResponse(res) {
    let body = null;
    try {
      body = await res.json();
    } catch {
      // no JSON body
    }
    return new ApiError(res.status, body?.code, body?.message, body?.details);
  }
}
