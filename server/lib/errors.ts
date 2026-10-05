export type DomainErrorKind = "validation" | "not_found" | "conflict" | "rate_limited";

/** Business-rule failure raised by services. The HTTP layer maps `kind` to a status code. */
export class DomainError extends Error {
  readonly kind: DomainErrorKind;
  readonly details?: unknown;
  constructor(kind: DomainErrorKind, message: string, details?: unknown) {
    super(message);
    this.kind = kind;
    this.details = details;
  }
}
