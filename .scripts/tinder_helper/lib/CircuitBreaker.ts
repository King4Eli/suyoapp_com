// Trips once consecutive failures hit `limit`. Reset on any success.
export class CircuitBreaker {
  private consecutiveFailures = 0;

  readonly limit: number;

  constructor(limit: number) {
    this.limit = limit;
  }

  get failures() {
    return this.consecutiveFailures;
  }

  get tripped() {
    return this.consecutiveFailures >= this.limit;
  }

  recordSuccess() {
    this.consecutiveFailures = 0;
  }

  recordFailure() {
    this.consecutiveFailures++;
  }
}
