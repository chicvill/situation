import { API_BASE } from '../config';

/**
 * 🛠️ PaymentService for PayApp Integration
 */
export const PaymentService = {
  // --- Debug Logger ---
  log(checkpoint: string, message: string, data?: any) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`%c[${checkpoint}] %c${timestamp} - ${message}`, "color: #f97316; font-weight: bold", "color: #64748b", data || '');
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
   * [CP-03] Initiate External Payment Gateway (PayApp)
   */
  async requestPayAppPayment(method: string, options: {
    amount: number;
    orderId: string;
    orderName: string;
    customerName: string;
    customerPhone?: string;
  }) {
    this.log("CP-03", "Opening Center Popup for PayApp Payment...");
    
    try {
      this.validateOptions(method, options);

      const payappMethod = method.includes('카드') ? 'card' : 'rbank';
      const baseUrl = `${window.location.origin}${window.location.pathname}`;

      // Calculate perfect center coordinates for the sleek payment popup
      const popupWidth = 540;
      const popupHeight = 700;
      const left = window.top ? (window.top.outerWidth - popupWidth) / 2 + window.top.screenX : (window.screen.width - popupWidth) / 2;
      const top = window.top ? (window.top.outerHeight - popupHeight) / 2 + window.top.screenY : (window.screen.height - popupHeight) / 2;

      // Construct a special URL to handle the payment flow inside the isolated popup window
      const phoneParam = options.customerPhone ? `&phone=${encodeURIComponent(options.customerPhone)}` : '';
      const popupUrl = `${baseUrl}?mode=payapp_popup&orderId=${options.orderId}&amount=${options.amount}&orderName=${encodeURIComponent(options.orderName)}&customerName=${encodeURIComponent(options.customerName)}&method=${encodeURIComponent(payappMethod)}${phoneParam}`;

      this.log("CP-03", "Launching Payment Popup Window...", { popupUrl });

      const paymentPopup = window.open(
        popupUrl,
        'PayAppPaymentPopup',
        `width=${popupWidth},height=${popupHeight},top=${top},left=${left},scrollbars=yes,resizable=yes`
      );

      if (!paymentPopup) {
        throw new Error('팝업 차단이 활성화되어 있습니다. 브라우저 설정에서 팝업을 허용해 주세요.');
      }

      return paymentPopup;
    } catch (e: any) {
      this.log("CP-03-ERR", "Payment popup initialization failed", e.message);
      throw e;
    }
  },

  /**
   * [CP-04] Finalize Payment on Backend
   */
  async confirmOnBackend(orderId: string, amount: string | number, paymentKey?: string) {
    this.log("CP-04", "Finalizing payment on backend...", { orderId, amount, paymentKey });
    try {
      const res = await fetch(`${API_BASE}/api/payment/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, amount, paymentKey })
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
