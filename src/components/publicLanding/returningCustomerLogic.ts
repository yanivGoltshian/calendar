export function shouldRenderReturningCustomer(
  upcomingCount: number,
  historyCount: number,
) {
  return upcomingCount > 0 || historyCount > 0;
}

export function formatReturningCustomerGreeting(name: string) {
  const trimmed = name.trim();
  return trimmed ? `שלום ${trimmed}` : 'שלום';
}
