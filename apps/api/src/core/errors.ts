export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
    public opId?: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
