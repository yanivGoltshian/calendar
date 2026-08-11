/**
 * ממשק ספק תשלומים. כרגע stub בלבד — אין חיוב אמיתי בשלב זה.
 * בעתיד יחובר לספק סליקה ישראלי (Tranzila / Meshulam / Stripe וכו').
 */
export interface PaymentsProvider {
  createCharge(params: {
    amountAgorot: number;
    description: string;
    clientPhone: string;
  }): Promise<{ id: string; status: 'pending' | 'paid' | 'failed' }>;
}

class StubPaymentsProvider implements PaymentsProvider {
  async createCharge(params: {
    amountAgorot: number;
    description: string;
    clientPhone: string;
  }): Promise<{ id: string; status: 'pending' | 'paid' | 'failed' }> {
    // eslint-disable-next-line no-console
    console.log(
      `\n💳 [PAYMENT stub] ${params.amountAgorot} אגורות עבור "${params.description}" (${params.clientPhone})\n`,
    );
    return { id: `stub_${Date.now()}`, status: 'pending' };
  }
}

let provider: PaymentsProvider | null = null;

export function getPaymentsProvider(): PaymentsProvider {
  if (!provider) provider = new StubPaymentsProvider();
  return provider;
}
