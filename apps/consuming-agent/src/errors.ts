export type DiscoveryErrorCode =
  | "REQUEST_FAILED"
  | "HTTP_STATUS"
  | "MALFORMED_JSON"
  | "NETWORK"
  | "CURRENCY"
  | "PAYTO_MISSING"
  | "PAYTO_ZERO"
  | "SERVICES_MISSING"
  | "SERVICE_ID"
  | "PRICE"
  | "ASSET"
  | "UNIT";

export class DiscoveryError extends Error {
  readonly code: DiscoveryErrorCode;

  constructor(code: DiscoveryErrorCode, message: string) {
    super(message);
    this.name = "DiscoveryError";
    this.code = code;
  }
}
