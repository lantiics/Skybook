export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

export class CaptchaFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaptchaFailedError";
  }
}

export class FilteredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FilteredError";
  }
}
export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class InvalidStatusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStatusError";
  }
}

export class LockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LockedError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ReservedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservedError";
  }
}

export class UnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnavailableError";
  }
}

export const errorStatus = (e: unknown, elevated: boolean): number => {
  console.error(e);
  if (
    e instanceof ReservedError ||
    e instanceof InvalidStatusError ||
    e instanceof BadRequestError ||
    e instanceof CaptchaFailedError
  )
    return 400;
  if (e instanceof UnauthorizedError) return elevated ? 403 : 401;
  if (e instanceof ForbiddenError) return 403;
  if (e instanceof NotFoundError) return 404;
  if (e instanceof Bun.SQL.PostgresError && e.errno === "23505") {
    // "23505" corresponds to the SQLSTATE for a unique_violation error
    return 409;
  }
  if (e instanceof FilteredError) return 422;
  if (e instanceof LockedError) return 423;

  if (e instanceof UnavailableError) return 503;

  return 500;
};
