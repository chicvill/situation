import { TOSS_CLIENT_KEY, API_BASE } from '../config';

/**
 * 🛠️ PaymentService with Enhanced Debugging Checkpoints
 */
export const PaymentService = {
  // --- Debug Logger ---
  log(checkpoint: string, message: string, data?: any) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`%c[${checkpoint}] %c${timestamp} - ${message}`, "color: #f97316; font-weight: bold", "color: #64748b", data || '');
  },

  /**
   * [CP-01] Get Toss Client Key
   */
  async getActiveClientKey(): Promise<string> {
    this.log("CP-01", "Fetching dynamic Toss Client Key...");
    try {
      const res = await fetch(`${API_BASE}/api/config/toss-key`);
      if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
      const data = await res.json();
      this.log("CP-01", "Success: Key loaded from backend", data.clientKey ? "Dynamic" : "Fallback used");
      return data.clientKey || TOSS_CLIENT_KEY;
    } catch (e: any) {
      this.log("CP-01-ERR", "Failed to fetch dynamic key", e.message);
      return TOSS_CLIENT_KEY;
    }
  },

  /**
   * [CP-02] Prepare & Validate Payment Options
   */
  validateOptions(method: string, options: any) {
    this.log("CP-02", "Validating payment options...", { method, amount: options.amount });
    if (!options.amount || options.amount <= 0) throw new Error("결제 금액이 올바르지 않습니다.");
    if (!options.orderId) throw new Error("주문 번호가 누락되었습니다.");
    return true;
  },

  /**
   * [CP-03] Initiate External Payment Gateway (Toss)
   */
  async requestTossPayment(method: string, options: {
    amount: number;
    orderId: string;
    orderName: string;
    customerName: string;
  }) {
    this.log("CP-03", "Initiating Toss Payment Window...");
    
    try {
      this.validateOptions(method, options);

      if (!(window as any).TossPayments) {
        this.log("CP-03-ERR", "Toss SDK NOT found in window");
        throw new Error('토스 결제 모듈이 로드되지 않았습니다. 페이지를 새로고침 해주세요.');
      }

      const clientKey = await this.getActiveClientKey();
      const toss = (window as any).TossPayments(clientKey);
      const tossMethod = method.includes('카드') ? '카드' : '계좌이체';
      const baseUrl = `${window.location.origin}${window.location.pathname}`;

      this.log("CP-03", "Redirecting to Toss Gateway...", { method: tossMethod, orderId: options.orderId });

      return toss.requestPayment(tossMethod, {
        amount: options.amount,
        orderId: options.orderId,
        orderName: options.orderName,
        customerName: options.customerName,
        successUrl: `${baseUrl}?payment_success=true&order_id=${options.orderId}&amount=${options.amount}`,
        failUrl: `${baseUrl}?payment_fail=true&order_id=${options.orderId}`,
      });
    } catch (e: any) {
      this.log("CP-03-ERR", "Payment initiation failed", e.message);
      throw e;
    }
  },

  /**
   * [CP-04] Finalize Payment on Backend
   */
  async confirmOnBackend(orderId: string, amount: string | number) {
    this.log("CP-04", "Finalizing payment on backend...", { orderId, amount });
    try {
      const res = await fetch(`${API_BASE}/api/payment/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, amount })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || '승인 실패');
      }
      
      this.log("CP-04", "Backend confirmation SUCCESS");
      return await res.json();
    } catch (e: any) {
      this.log("CP-04-ERR", "Backend confirmation FAILED", e.message);
      throw e;
    }
  }
};
