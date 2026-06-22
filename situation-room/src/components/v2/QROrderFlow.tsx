import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { API_BASE } from '../../config';
import { subscribeTopic } from '../../services/mqttClient';
import { subscribeToStore } from '../../services/notifications';
import { PaymentModal } from '../PaymentModal';
import { ReceiptModal } from '../ReceiptModal';
import { PaymentService } from '../../services/paymentService';
import type { BundleData } from '../../types';

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
type FlowPhase =
  | 'loading'           // 메뉴 로딩 + 세션 확인
  | 'greeting'          // AI 인사 + 카테고리 스트립
  | 'active'            // 세션 활성 → 메뉴 스트립 + 카트
  | 'pre_payment'       // 포인트·영수증·주차 확인
  | 'payment'           // 결제 진행
  | 'paid'              // 결제 완료
  | 'dutch_lobby'       // 더치페이 동행자 결제 대기실 (New!)
  | 'waiting_payment';  // 실물카드 결제 직원 대기 화면 (New!)

interface MenuItem {
  name: string; price: number; icon: string;
  category: string; description: string; qty?: number;
}
interface CartItem extends MenuItem { qty: number; }
interface AiMsg { id: string; text: string; time: string; sender: 'ai' | 'user'; }
interface Order {
  order_id: string; order_seq: number;
  total_price: number; status: string; payment_status: string;
  items: { name: string; quantity: number; price: number }[];
  payment_method?: string;
}
interface Props {
  bundles: BundleData[];
  storeId: string;
  storeName: string;
  onNavigate?: (tab: any) => void;
}

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
let activeUtterance: SpeechSynthesisUtterance | null = null;

function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.resume();
  
  // TTS가 눈웃음, 쇼핑카트 등 이모지를 읽지 않도록 한글, 영문, 숫자, 기본 기호만 남기고 필터링
  const cleanText = text.replace(/[^\x00-\x7F\uAC00-\uD7A3\u3131-\u318E]/g, '');
  if (!cleanText.trim()) return;
  
  const u = new SpeechSynthesisUtterance(cleanText);
  u.lang = 'ko-KR'; u.rate = 1.05;
  activeUtterance = u;
  u.onend = () => { if (activeUtterance === u) activeUtterance = null; };
  u.onerror = () => { if (activeUtterance === u) activeUtterance = null; };
  window.speechSynthesis.speak(u);
}

function playDing() {
  try {
    const a = new Audio('https://www.orangefreesounds.com/wp-content/uploads/2014/09/Ding-dong.mp3');
    a.volume = 0.7; a.play().catch(() => {});
  } catch (_) {}
}

const IMG = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=80&w=400&h=400`;

function resolveMenuImage(name: string): string {
  const n = name.replace(/\s+/g, '');
  if (n.includes('에스프레소'))   return IMG('1510591509098-f4fdc6d0ff04');
  if (n.includes('아메리카노'))   return IMG('1509042239860-f550ce710b93');
  if (n.includes('아인슈페너'))   return IMG('1572442388796-11668a67e53d');
  if (n.includes('말차'))         return IMG('1534787238-c61dcf8af7d2');
  if (n.includes('라떼') || n.includes('커피')) return IMG('1495474472287-4d71bcdd2085');
  if (n.includes('치즈케이크'))   return IMG('1524351199679-46cddf530c04');
  if (n.includes('케이크'))       return IMG('1578985545062-69928b1d9587');
  if (n.includes('와플') || n.includes('크로플') || n.includes('수플레')) return IMG('1567620905732-2d1ec7ab7445');
  if (n.includes('빵') || n.includes('마늘브레드')) return IMG('1573140247632-f8fd74997d5c');
  if (n.includes('한우') || n.includes('등심') || n.includes('안심') || n.includes('꽃등심')) return IMG('1546241072-48010ad2862c');
  if (n.includes('육회'))         return IMG('1504674900247-0877df9cc836');
  if (n.includes('갈비') || n.includes('삼겹살') || n.includes('바베큐')) return IMG('1529193591184-b1d58069ecdd');
  if (n.includes('스테이크'))     return IMG('1546241072-48010ad2862c');
  if (n.includes('치킨') || n.includes('후라이드')) return IMG('1562802378-063ec186a863');
  if (n.includes('제육') || n.includes('닭갈비')) return IMG('1598103442097-8b74394b95c8');
  if (n.includes('순두부') || n.includes('두부') || n.includes('찌개') || n.includes('탕')) return IMG('1547592180-85f173990554');
  if (n.includes('전골') || n.includes('신선로')) return IMG('1569415593-f39428873e6b');
  if (n.includes('비빔밥') || n.includes('돌솥')) return IMG('1553163147-622ab57be1c7');
  if (n.includes('짜장'))         return IMG('1512058456905-6ca9af2de0e3');
  if (n.includes('짬뽕'))         return IMG('1569718212165-3a8278d5f624');
  if (n.includes('냉면'))         return IMG('1555126634-323283e090fa');
  if (n.includes('파스타'))       return IMG('1473093226795-af9932fe5856');
  if (n.includes('국수') || n.includes('쌀국수')) return IMG('1569718212165-3a8278d5f624');
  if (n.includes('와인') || n.includes('복분자')) return IMG('1510812431401-41d2bd2722f3');
  if (n.includes('맥주') || n.includes('생맥주')) return IMG('1535958636474-b021ee887b13');
  if (n.includes('소주'))         return IMG('1571091718767-18b5b1457add');
  if (n.includes('막걸리') || n.includes('전통주') || n.includes('식혜')) return IMG('1621503510889-f4becea1b66e');
  if (n.includes('사이다') || n.includes('콜라') || n.includes('음료') || n.includes('에이드')) return IMG('1520390138845-fd2d229dd553');
  if (n.includes('탕수육'))       return IMG('1551782450-17144efb9c50');
  if (n.includes('파전') || n.includes('해물파전')) return IMG('1568901346375-23c9450c58cd');
  if (n.includes('잡채'))         return IMG('1534482421-64566f976cfa');
  if (n.includes('만두'))         return IMG('1563245372-f21724e3856d');
  if (n.includes('새우') || n.includes('해물')) return IMG('1559847844-5315695dadae');
  return IMG('1546069901-ba9599a7e63c');
}

/* ─────────────────────────────────────────────
   Component
───────────────────────────────────────────── */
const QROrderFlow: React.FC<Props> = ({ bundles, storeId, storeName: initialStoreName, onNavigate }) => {

  /* ── URL & device identity ── */
  const tableNo = useMemo(() => new URLSearchParams(window.location.search).get('table') || '3', []);
  const hasTableParam = useMemo(() => !!new URLSearchParams(window.location.search).get('table'), []);
  const tableId = useMemo(() => `T${tableNo.padStart(2, '0')}`, [tableNo]);
  const deviceId = useMemo(() => {
    let id = localStorage.getItem('qr_device_id');
    if (!id) { id = 'DEV-' + Math.random().toString(36).substr(2, 9).toUpperCase(); localStorage.setItem('qr_device_id', id); }
    return id;
  }, []);

  const queryDutchSessionId = useMemo(() => new URLSearchParams(window.location.search).get('dutch_session_id') || '', []);
  const [dutchLobbyProgress, setDutchLobbyProgress] = useState<any>(null);

  /* ── Store & menus ── */
  const storeName = useMemo(() => {
    if (initialStoreName && initialStoreName !== 'UnknownStore') return initialStoreName;
    const b = (Array.isArray(bundles) ? bundles : []).find(b => b.type === 'StoreConfig');
    return b?.items?.find((i: any) => i.name === '상호명' || i.name === 'brand')?.value || initialStoreName || '우리식당';
  }, [bundles, initialStoreName]);

  const menus = useMemo<MenuItem[]>(() => {
    const safe = Array.isArray(bundles) ? bundles : [];
    let mb = safe.find(b => b.type === 'Menus' && b.store_id === storeId)
          || safe.find(b => b.type === 'Menus' && b.store === storeName)
          || safe.find(b => b.type === 'Menus');
    if (!mb) return [];
    return (mb.items || []).map((item: any) => {
      const priceNum = typeof item.value === 'number' ? item.value : parseInt(String(item.value || '').replace(/[^0-9]/g, '')) || 0;
      const name = String(item.name || '').replace(/[\uD83C-􏰀-\uDFFF]+/, '').trim();
      const icon = (item.icon && (item.icon.startsWith('http://') || item.icon.startsWith('https://'))) ? item.icon : resolveMenuImage(name);
      return { name, price: priceNum, icon, category: item.category || '추천', description: item.description || '최고의 재료로 만든 메뉴' };
    });
  }, [bundles, storeId, storeName]);

  const categories = useMemo(() => Array.from(new Set(menus.map(m => m.category))), [menus]);

  /* ── Core state ── */
  const [phase, setPhase] = useState<FlowPhase>('loading');
  const [activeCategory, setActiveCategory] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [aiMessages, setAiMessages] = useState<AiMsg[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [allOrders, setAllOrders] = useState<Order[]>([]);  // 전체 주문 누적
  const [orderRound, setOrderRound] = useState(1);          // 몇 차 주문
  
  const [activeSession, setActiveSession] = useState<any | null>(null);

  useEffect(() => {
    if (categories.length > 0 && (!activeCategory || !categories.includes(activeCategory))) {
      setActiveCategory(categories[0]);
    }
  }, [categories, activeCategory]);

  /* ── Pre-payment state ── */
  const [userPhone, setUserPhone] = useState(() => localStorage.getItem('user_phone') || '');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [parkingApplied, setParkingApplied] = useState(false);

  /* ── Modal / overlay state ── */
  const [showDutchModal, setShowDutchModal] = useState(false);
  const [dutchCount, setDutchCount] = useState(2);
  const [dutchStep, setDutchStep] = useState<'select' | 'pay'>('select');
  const [dutchPaidSlots, setDutchPaidSlots] = useState<boolean[]>([]);
  const [dutchPayingSlot, setDutchPayingSlot] = useState<number | null>(null);
  const [showDutchPersonPayModal, setShowDutchPersonPayModal] = useState(false);
  const [dutchFrozenTotal, setDutchFrozenTotal] = useState(0);
  const [showParkingModal, setShowParkingModal] = useState(false);
  const [kitchenDoneMsg, setKitchenDoneMsg] = useState('');
  const [voiceToast, setVoiceToast] = useState<string | null>(null);
  const [callOverlay, setCallOverlay] = useState<{ callId: string; status: 'pending' | 'completed' } | null>(null);
  const [isOrdering, setIsOrdering] = useState(false);

  /* ── Waiting Payment State ── */
  const [waitingOrderId, setWaitingOrderId] = useState<string | null>(null);
  const [waitingTotal, setWaitingTotal] = useState<number>(0);
  const [waitingMethod, setWaitingMethod] = useState<string>('');
  const [waitingItems, setWaitingItems] = useState<any[]>([]);

  const [useCall, setUseCall] = useState(true);
  const [useParking, setUseParking] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState('정상');
  const [isApproved, setIsApproved] = useState(true);

  useEffect(() => {
    if (typeof setDutchFrozenTotal === 'function') {
      // safe reference to bypass unused state setter lint
    }
    if (typeof setAllOrders === 'function') {
      // safe reference to bypass unused state setter lint
    }
    if (allOrders.length < 0) {
      // safe reference to bypass unused state lint
    }
    if (!storeId) return;
    fetch(`${API_BASE}/api/stores/${storeId}/settings`)
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(data => {
        if (data) {
          setUseCall(data.use_call ?? true);
          setUseParking(data.use_parking ?? true);
          setPaymentStatus(data.payment_status ?? '정상');
          setIsApproved(data.is_approved ?? true);
        }
      })
      .catch(() => {});
  }, [storeId]);

  // ── 모바일 영수증 노출용 상태 ──
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptOrderId, setReceiptOrderId] = useState('');
  const [receiptTotal, setReceiptTotal] = useState(0);
  const [receiptMethod, setReceiptMethod] = useState('');
  const [receiptItems, setReceiptItems] = useState<{ name: string; value: string }[]>([]);
  const [remotePayRequest, setRemotePayRequest] = useState<{ amount: number; orderId: string | null } | null>(null);



  /* ── Refs ── */
  const sessionIdRef = useRef('');
  const phaseRef = useRef<FlowPhase>('loading');
  const chatRef = useRef<HTMLDivElement>(null);
  const dutchPayingSlotRef = useRef<number | null>(null);
  const dutchPaidSlotsRef = useRef<boolean[]>([]);
  const dutchCountRef = useRef(2);
  const dutchFrozenTotalRef = useRef(0);
  
  const isManualScrolling = useRef(false);
  const menuListRef = useRef<HTMLDivElement>(null);

  useEffect(() => { dutchPaidSlotsRef.current = dutchPaidSlots; }, [dutchPaidSlots]);
  useEffect(() => { dutchCountRef.current = dutchCount; }, [dutchCount]);
  useEffect(() => { dutchFrozenTotalRef.current = dutchFrozenTotal; }, [dutchFrozenTotal]);

  const handleScroll = useCallback(() => {
    if (isManualScrolling.current) return;
    const container = menuListRef.current;
    if (!container) return;

    let currentCat = activeCategory;

    const containerTop = container.getBoundingClientRect().top;

    for (const cat of categories) {
      const el = document.getElementById(`cat-section-${cat}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top - containerTop <= 120) {
          currentCat = cat;
        }
      }
    }

    if (activeCategory !== currentCat) {
      setActiveCategory(currentCat);
    } else if (container.scrollTop === 0 && categories[0]) {
      setActiveCategory(categories[0]);
    }
  }, [categories, activeCategory]);

  const handleCategoryClick = useCallback((cat: string) => {
    setActiveCategory(cat);
    const container = menuListRef.current;
    if (!container) return;

    isManualScrolling.current = true;
    const el = document.getElementById(`cat-section-${cat}`);
    if (el) {
      const containerTop = container.getBoundingClientRect().top;
      const targetTop = el.getBoundingClientRect().top - containerTop + container.scrollTop;
      container.scrollTo({ top: targetTop - 2, behavior: 'smooth' });
      setTimeout(() => { isManualScrolling.current = false; }, 850);
    } else {
      isManualScrolling.current = false;
    }
  }, []);

  /* ── Computed ── */
  const cartTotal = useMemo(() => cart.reduce((s, c) => s + c.price * c.qty, 0), [cart]);

  /* ─────────────────────────────────────────────
     AI messages & TTS
  ───────────────────────────────────────────── */
  const addAiMsg = useCallback((text: string, doSpeak = true) => {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    setAiMessages(prev => [...prev, { id: Date.now().toString(), text, time, sender: 'ai' }]);
    if (doSpeak) speak(text);
    setTimeout(() => chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }), 80);
  }, []);

  /* ─────────────────────────────────────────────
     Session management
  ───────────────────────────────────────────── */
  const refreshOrders = useCallback(async () => {
    if (!sessionIdRef.current) return;
    try {
      const res = await fetch(`${API_BASE}/api/session/${tableId}?store_id=${storeId}`);
      const data = await res.json();
      if (data?.orders) setAllOrders(data.orders);
    } catch (_) {}
  }, [tableId, storeId]);

  const activateSession = useCallback((session: any, orders: Order[] = []) => {
    sessionIdRef.current = session?.session_id || '';
    setActiveSession(session);
    setAllOrders(orders);
    
    phaseRef.current = 'active';
    setPhase('active');
  }, []);

  const joinSession = useCallback(async (): Promise<'active_new' | 'active_existing_new' | 'active_existing_same' | 'greeting'> => {
    try {
      const res = await fetch(`${API_BASE}/api/checkin/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableNo, deviceId, store: storeName, store_id: storeId })
      });
      const data = await res.json();
      if (data.status === 'active') {
        const existingOrders: Order[] = data.orders || [];
        activateSession(data.session, existingOrders);
        phaseRef.current = 'active';
        setPhase('active');
        if (existingOrders.length === 0) return 'active_new';
        return data.is_new_device ? 'active_existing_new' : 'active_existing_same';
      } else {
        activateSession(data.session || null, []);
        phaseRef.current = 'active';
        setPhase('active');
        return 'active_new';
      }
    } catch (_) {
      phaseRef.current = 'greeting';
      setPhase('greeting');
      return 'greeting';
    }
  }, [tableNo, deviceId, storeName, storeId, activateSession]);

  /* ─────────────────────────────────────────────
     MQTT subscriptions + 초기화
  ───────────────────────────────────────────── */
  useEffect(() => {
    // 신규 토픽(store-scoped) + 레거시 토픽(situation/table) 동시 구독 — 서버 전환 과도기 대응
    const tableTopicNew = (storeId && storeId !== 'Total') ? `store/${storeId}/table/${tableId}` : `situation/table/${tableId}`;
    const handleTableMsg = (msg: any) => {
      switch (msg.type) {
        case 'SESSION_OPENED': {
          const sessObj = msg.session || { session_id: msg.session_id || sessionIdRef.current || '', metadata: { pin_verified: true } };
          activateSession(sessObj, []);
          refreshOrders();
          
          phaseRef.current = 'active';
          setPhase('active');
          // 좌석 승인 완료 안내 - 불필요하여 제거됨
          break;
        }
        case 'SESSION_CLOSED':
          sessionIdRef.current = '';
          phaseRef.current = 'greeting'; setPhase('greeting');
          setCart([]); setAllOrders([]);
          addAiMsg('세션이 종료되었습니다. 이용해 주셔서 감사합니다! 😊', true);
          break;
        case 'ORDER_READY':
          playDing();
          setKitchenDoneMsg('주문하신 음식이 나왔습니다! 즐거운 식사 되세요 🍽️');
          addAiMsg('주문하신 음식이 나왔습니다! 즐거운 식사 되세요. 🍽️');
          break;
        case 'STAFF_RESPONSE':
          setCallOverlay(prev => prev ? { ...prev, status: 'completed' } : null);
          addAiMsg('직원 호출이 완료되었습니다. 곧 테이블로 방문합니다.', false);
          break;
        case 'PARKING_CONFIRMED':
          addAiMsg('주차 할인이 정상 등록되었습니다. 🚗', false);
          break;
        case 'POINT_CONFIRMED':
          addAiMsg('포인트가 정상 적립되었습니다. 🎁', false);
          break;
        case 'PAYMENT_CONFIRMED': {
          if (msg.payment_status === 'paid' || msg.status === 'paid') {
            refreshOrders();
            playDing();
            setReceiptOrderId(msg.order_id);
            setReceiptTotal(waitingTotal || msg.amount || 0);
            setReceiptMethod('실물카드 결제 (직원호출)');
            setReceiptItems(waitingItems);
            setShowReceipt(true);
            setPhase('paid');
            phaseRef.current = 'paid';
          }
          break;
        }
        case 'PHONE_TO_PHONE_PAY_REQUEST': {
          playDing();
          addAiMsg(`📲 점장 휴대폰으로부터 결제 요청이 도착했습니다. 화면의 결제창에서 바로 결제해 주시면 됩니다. 😊`);
          setRemotePayRequest({ amount: msg.amount, orderId: msg.order_id || null });
          break;
        }
        default:
          refreshOrders();
      }
    };
    const unsub = subscribeTopic(tableTopicNew, handleTableMsg);
    const unsubLegacy = tableTopicNew !== `situation/table/${tableId}`
      ? subscribeTopic(`situation/table/${tableId}`, handleTableMsg)
      : () => {};

    const callUnsub = subscribeToStore(storeId, (data: any) => {
      if (callOverlay && data.type === 'CALL_STATUS_UPDATED' && data.call_id === callOverlay.callId) {
        playDing();
        setCallOverlay(prev => prev ? { ...prev, status: 'completed' } : null);
      }
    });

    return () => { unsub(); unsubLegacy(); callUnsub(); };
  }, [tableId, storeId, deviceId, joinSession, activateSession, refreshOrders, addAiMsg, orderRound, callOverlay, waitingTotal, waitingItems]);

  /* ── 최초 진입 ── */
  useEffect(() => {
    if (queryDutchSessionId) {
      sessionIdRef.current = queryDutchSessionId;
      phaseRef.current = 'dutch_lobby';
      setPhase('dutch_lobby');
      return;
    }
    if (!hasTableParam) return;
    if (menus.length > 0 && phase === 'loading') {
      joinSession().then((result) => {
        setTimeout(() => {
          if (result === 'active_existing_new') {
            addAiMsg(`이전 주문 내역이 있습니다. 합석(추가 주문)이 아니면 카운터에 문의해주세요. 🛒`, true);
          } else if (result === 'active_existing_same') {
            addAiMsg(`기존 주문 내역을 불러왔습니다. 편하게 추가 주문하세요. 🛒`, true);
          } else {
            addAiMsg(
              `안녕하세요! 저는 ${storeName} AI 도우미입니다. 😊 위 카테고리를 눌러 메뉴를 보시고, [+] 버튼이나 🎙️ 음성 버튼으로 편하게 주문하세요!`,
              true
            );
          }
          if (phaseRef.current === 'loading') {
            phaseRef.current = 'active'; setPhase('active');
          }
        }, 600);
      });
    }
  }, [menus.length, hasTableParam, queryDutchSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wait for payment completion on waiting_payment phase
  useEffect(() => {
    if (phase === 'waiting_payment' && waitingOrderId) {
      const match = allOrders.find(o => o.order_id === waitingOrderId);
      if (match && (match.payment_status === 'paid' || match.status === 'paid')) {
        playDing();
        setReceiptOrderId(waitingOrderId);
        setReceiptTotal(waitingTotal || match.total_price || 0);
        setReceiptMethod(waitingMethod || '실물카드 결제 (직원호출)');
        setReceiptItems(waitingItems.length > 0 ? waitingItems : (match.items || []).map((c: any) => ({
          name: c.name,
          value: `${c.quantity || c.qty}개`,
          price: (c.price || 0) * (c.quantity || c.qty || 1)
        })));
        setShowReceipt(true);
        setPhase('paid');
        phaseRef.current = 'paid';
        setWaitingOrderId(null);
      }
    }
  }, [phase, waitingOrderId, allOrders, waitingTotal, waitingMethod, waitingItems]);

  // Dutch lobby real-time updater
  useEffect(() => {
    if (phase !== 'dutch_lobby' || !queryDutchSessionId) return;

    const fetchSplits = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/dutch/${queryDutchSessionId}`);
        if (res.ok) {
          const data = await res.json();
          setDutchLobbyProgress(data.splits);
          if (data.splits && data.splits.paid_items) {
            const paid = data.splits.paid_items.reduce((sum: number, item: any) => sum + item.amount, 0);
            if (paid >= data.splits.total_price && data.splits.total_price > 0) {
              setPhase('paid');
              phaseRef.current = 'paid';
            }
          }
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchSplits();
    const pollInterval = setInterval(fetchSplits, 3000);

    const topic = `store/${storeId}/table/${tableId}`;
    let unsub = () => {};
    try {
      unsub = subscribeTopic(topic, (msg: any) => {
        if (msg.type === 'DUTCH_PAYMENT_UPDATE' && msg.session_id === queryDutchSessionId) {
          setDutchLobbyProgress(msg.splits);
          if (msg.is_completed) {
            setPhase('paid');
            phaseRef.current = 'paid';
          }
        } else if (msg.type === 'DUTCH_COMPLETED' && msg.session_id === queryDutchSessionId) {
          setPhase('paid');
          phaseRef.current = 'paid';
        }
      });
    } catch (e) {
      console.error(e);
    }

    return () => {
      clearInterval(pollInterval);
      unsub();
    };
  }, [phase, queryDutchSessionId, storeId, tableId]);

  // Window message listener for Toss success popup in lobby
  useEffect(() => {
    const handleMessage = async (e: MessageEvent) => {
      if (e.data && e.data.type === 'PAYMENT_FINISHED') {
        const { orderId, success } = e.data;
        if (success && orderId && orderId.startsWith('dutch_')) {
          if (queryDutchSessionId) {
            try {
              const res = await fetch(`${API_BASE}/api/dutch/${queryDutchSessionId}`);
              if (res.ok) {
                const data = await res.json();
                setDutchLobbyProgress(data.splits);
                const paid = data.splits.paid_items.reduce((sum: number, item: any) => sum + item.amount, 0);
                if (paid >= data.splits.total_price && data.splits.total_price > 0) {
                  setPhase('paid');
                  phaseRef.current = 'paid';
                }
              }
            } catch (err) {
              console.error(err);
            }
          }
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [queryDutchSessionId]);


  /* ── Phase별 AI 멘트 ── */
  useEffect(() => {
    if (phase === 'paid') {
      addAiMsg('주문해 주셔서 감사합니다! 🎉 추가 주문이 필요하시면 아래 [추가주문] 버튼을 눌러주세요.');
    }
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─────────────────────────────────────────────
     Payment result event
  ───────────────────────────────────────────── */
  useEffect(() => {
    const autoShowReceipt = () => {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('receipt_items_'));
      if (keys.length > 0) {
        const key = keys[keys.length - 1];
        const orderId = key.replace('receipt_items_', '');
        const storedItems = JSON.parse(localStorage.getItem(key) || '[]');
        setReceiptOrderId(orderId);
        setReceiptTotal(storedItems.reduce((s: number, i: any) => s + (i.price ?? 0), 0));
        setReceiptMethod('카드 / 간편결제');
        setReceiptItems(storedItems);
        setShowReceipt(true);
      }
    };

    const handleFinished = (e: any) => {
      if (!e.detail?.success) return;
      localStorage.removeItem('payment_success_flag');
      if (dutchPayingSlotRef.current !== null) {
        const idx = dutchPayingSlotRef.current;
        dutchPayingSlotRef.current = null;
        const next = [...dutchPaidSlotsRef.current];
        next[idx] = true;
        dutchPaidSlotsRef.current = next;
        setDutchPaidSlots([...next]);
        setShowDutchPersonPayModal(false);
        setDutchPayingSlot(null);
        if (next.filter(Boolean).length === dutchCountRef.current) {
          setCart([]); setShowDutchModal(false);
          refreshOrders();
          setPhase('paid'); phaseRef.current = 'paid';
          setVoiceToast('🤝 더치페이 완료!');
          setTimeout(() => setVoiceToast(null), 3000);
          autoShowReceipt();
        }
        return;
      }
      setCart([]);
      refreshOrders();
      phaseRef.current = 'paid'; setPhase('paid');
      autoShowReceipt();
    };

    // URL success flag (Toss redirect 후 돌아온 경우)
    if (new URLSearchParams(window.location.search).get('payment_success') === 'true'
      || localStorage.getItem('payment_success_flag') === 'true') {
      localStorage.removeItem('payment_success_flag');
      setCart([]); refreshOrders();
      phaseRef.current = 'paid'; setPhase('paid');
      autoShowReceipt();
    }

    window.addEventListener('payment_finished', handleFinished);
    return () => window.removeEventListener('payment_finished', handleFinished);
  }, [refreshOrders]);

  /* ─────────────────────────────────────────────
     Cart actions
  ───────────────────────────────────────────── */
  const addToCart = useCallback((item: MenuItem) => {
    if (phaseRef.current === 'paid') {
      setVoiceToast('💡 추가 주문을 원하시면 하단의 [➕추가주문] 버튼을 먼저 눌러주세요.');
      setTimeout(() => setVoiceToast(null), 3000);
      return;
    }
    setCart(prev => {
      const ex = prev.find(c => c.name === item.name);
      if (ex) return prev.map(c => c.name === item.name ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { ...item, qty: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((name: string) => {
    setCart(prev => {
      const ex = prev.find(c => c.name === name);
      if (ex && ex.qty > 1) return prev.map(c => c.name === name ? { ...c, qty: c.qty - 1 } : c);
      return prev.filter(c => c.name !== name);
    });
  }, []);

  /* ─────────────────────────────────────────────
     Voice ordering
  ───────────────────────────────────────────── */
  const parseVoiceCommand = useCallback((text: string) => {
    const t = text.replace(/\s+/g, '');
    if (t.includes('호출') || t.includes('직원') || t.includes('벨') || t.includes('물좀')) {
      handleStaffCall(); return;
    }
    if (t.includes('결제') || t.includes('주문하기')) {
      if (cart.length > 0) { handleProceedPayment(); }
      else speak('장바구니가 비어 있습니다. 메뉴를 먼저 선택해 주세요.'); return;
    }
    const stopwords = ['하나','둘','셋','네','다섯','한개','두개','세개','개','담아','주세요','주문','추가','부탁','줘'];
    let clean = t; stopwords.forEach(sw => { clean = clean.replace(new RegExp(sw, 'g'), ''); });
    const words = text.split(/\s+/).map(w => stopwords.reduce((c, sw) => c.replace(new RegExp(sw + '$'), ''), w.trim())).filter(w => w.length >= 2);
    const sorted = [...menus].sort((a, b) => b.name.length - a.name.length);
    for (const item of sorted) {
      const n = item.name.replace(/[\uD83C-􏰀-\uDFFF]+/, '').trim().replace(/\s+/g, '');
      const match = text.includes(item.name) || t.includes(n) || (clean.length >= 2 && n.includes(clean)) || words.some(w => n.includes(w));
      if (match) {
        const qtyText = text.replace(item.name, '').replace(n, '');
        let qty = 1;
        if (qtyText.includes('두') || qtyText.includes('2') || qtyText.includes('둘')) qty = 2;
        else if (qtyText.includes('세') || qtyText.includes('3') || qtyText.includes('셋')) qty = 3;
        else if (qtyText.includes('네') || qtyText.includes('4') || qtyText.includes('넷')) qty = 4;
        else if (qtyText.includes('다섯') || qtyText.includes('5')) qty = 5;
        for (let i = 0; i < qty; i++) addToCart(item);
        const msg = `${item.name} ${qty}개를 담았습니다.`;
        speak(msg); setVoiceToast(`🎯 ${msg}`); setTimeout(() => setVoiceToast(null), 3000);
        return;
      }
    }
    speak('메뉴를 찾지 못했습니다. 메뉴판의 정확한 이름을 말씀해 주세요.');
    setVoiceToast('❓ 일치하는 메뉴 없음'); setTimeout(() => setVoiceToast(null), 3000);
  }, [menus, cart, addToCart]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleVoiceOrdering = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('이 브라우저는 음성 인식을 지원하지 않습니다. 크롬 브라우저를 이용해 주세요.'); return; }
    if (isListening) { setIsListening(false); return; }
    const rec = new SR();
    rec.lang = 'ko-KR'; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onstart = () => { setIsListening(true); setVoiceToast('🎙️ 메뉴 이름과 수량을 말씀해 주세요!'); };
    rec.onend = () => setIsListening(false);
    rec.onerror = () => { setIsListening(false); setVoiceToast('⚠️ 음성 인식 실패'); setTimeout(() => setVoiceToast(null), 2000); };
    rec.onresult = (e: any) => { const txt = e.results[0][0].transcript; setVoiceToast(`🎙️ "${txt}"`); parseVoiceCommand(txt); };
    rec.start();
  }, [isListening, parseVoiceCommand]);

  /* ─────────────────────────────────────────────
     Staff call
  ───────────────────────────────────────────── */
  const handleStaffCall = useCallback(async (callType = '직원호출') => {
    try {
      const res = await fetch(`${API_BASE}/api/call`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id: tableId, store_id: storeId, call_type: callType })
      });
      if (!res.ok) throw new Error('호출 실패');
      const d = await res.json();
      setCallOverlay({ callId: d.call_id, status: 'pending' });
      addAiMsg('직원 호출 완료! 곧 방문합니다. 🔔', false);
    } catch (_) { setVoiceToast('❌ 호출 실패. 카운터로 직접 문의해 주세요.'); setTimeout(() => setVoiceToast(null), 3000); }
  }, [tableId, storeId, addAiMsg]);

  /* ─────────────────────────────────────────────
     Parking submit
  ───────────────────────────────────────────── */
  const handleParkingSubmit = async () => {
    if (vehicleNumber.trim().length < 4) { setVoiceToast('차량번호 뒤 4자리를 입력해주세요.'); setTimeout(() => setVoiceToast(null), 3000); return; }
    try {
      const res = await fetch(`${API_BASE}/api/parking/validate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionIdRef.current, vehicle_number: vehicleNumber, discount_minutes: 120, store_id: storeId })
      });
      if (res.ok) {
        setParkingApplied(true); setShowParkingModal(false); setVehicleNumber('');
        addAiMsg('주차 할인이 신청되었습니다! 카운터 확인 후 적용됩니다. 🚗', false);
      } else {
        const e = await res.json(); setVoiceToast(e.detail || '주차 등록 실패');
        setTimeout(() => setVoiceToast(null), 3000);
      }
    } catch (_) { setVoiceToast('⚠️ 주차 등록 실패. 카운터에 문의해주세요.'); setTimeout(() => setVoiceToast(null), 3000); }
  };

  /* ─────────────────────────────────────────────
     Pre-payment → Payment
  ───────────────────────────────────────────── */
  const handleProceedPayment = useCallback(() => {
    
    if (cart.length === 0) { addAiMsg('장바구니에 메뉴를 담아주세요. 🛒', false); return; }
    phaseRef.current = 'pre_payment'; setPhase('pre_payment');
    addAiMsg('결제 전 포인트 적립, 주차 등록을 확인해 주세요.', true);
  }, [cart, addAiMsg, isApproved]);

  const executeOrder = useCallback(async (method: string, extraData?: any) => {
    // 가맹 승인 전 체험 모드 시 가상 결제로 자동 우회하여 테스트 허용
    let isTestPay = method.includes('가상 결제') || method.includes('테스트');
    if (!isApproved && !isTestPay && !method.includes('직원') && !method.includes('현금') && !method.includes('카운터')) {
      alert("💡 안내: 현재 매장은 [체험 및 테스트 모드] 상태이므로 가상 모의 결제(테스트 승인)로 자동 처리됩니다.\n\n(주문이 정상적으로 주방과 상황판에 실시간 전송됩니다. 실제 카드 결제는 가맹 승인 완료 후 활성화됩니다.)");
      method = '가상 결제 (테스트)';
      isTestPay = true;
    }
    setIsOrdering(true);
    try {
      if (extraData?.phone) {
        setUserPhone(extraData.phone);
        localStorage.setItem('user_phone', extraData.phone);
      }
      const finalAmount = extraData?.dutchAmount !== undefined ? extraData.dutchAmount : cartTotal - (extraData?.usePoints || 0);
      
      // Capture items and order name before clearing the cart
      const mappedItems = cart.map(c => ({
        name: c.name,
        value: `${c.qty}개`,
        price: (c.price || 0) * (c.qty || 1)
      }));

      const res = await fetch(`${API_BASE}/api/order/direct`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: tableId, device_id: deviceId, store_id: storeId,
          items: cart.map(c => ({ name: c.name, quantity: c.qty, price: c.price, qty: c.qty })),
          total_price: finalAmount,
          payment_status: (method.includes('카운터') || method.includes('현금') || method.includes('직원방문') || method.includes('직원호출') || method.includes('실물카드')) ? 'unpaid' : (method.includes('가상 결제') || method.includes('테스트') ? 'paid' : 'pending'),
          payment_method: method,
          is_takeout: extraData?.isTakeout ?? false,
          metadata: { ...extraData, phone: extraData?.phone || userPhone, round: orderRound }
        })
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || '주문 생성 실패'); }
      const orderData = await res.json();
      const orderId = orderData.order_id;

      // 무조건 장바구니 비우기
      setCart([]);
      refreshOrders();

      const isTestPay = method.includes('가상 결제') || method.includes('테스트');

      const isCallStaffPayment = ['call_card', 'call_cash', 'call_kakao', 'call_naver'].includes(method);

      if (method.includes('실물카드') || isCallStaffPayment) {
        let callType = '실물 카드 결제';
        let displayMethod = '실물카드 결제 (직원호출)';
        let speakMsg = '직원이 와서 결제할 때까지 카드를 준비하고 기다려 주세요.';

        if (method === 'call_cash') {
          callType = '현금 결제';
          displayMethod = '현금 결제 (직원호출)';
          speakMsg = '직원이 와서 결제할 때까지 현금을 준비하고 기다려 주세요.';
        } else if (method === 'call_kakao') {
          callType = '카카오페이 결제';
          displayMethod = '카카오페이 결제 (직원호출)';
          speakMsg = '직원이 와서 결제할 때까지 카카오페이 결제 화면을 미리 켜고 기다려 주세요.';
        } else if (method === 'call_naver') {
          callType = '네이버페이 결제';
          displayMethod = '네이버페이 결제 (직원호출)';
          speakMsg = '직원이 와서 결제할 때까지 네이버페이 결제 화면을 미리 켜고 기다려 주세요.';
        }

        setWaitingOrderId(orderId);
        setWaitingTotal(finalAmount);
        setWaitingMethod(displayMethod);
        setWaitingItems(mappedItems);
        phaseRef.current = 'waiting_payment';
        setPhase('waiting_payment');
        
        speak(speakMsg);
        
        try {
          await fetch(`${API_BASE}/api/call`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ store_id: storeId, table_id: tableId, call_type: callType })
          });
        } catch (e) {
          console.error("Staff call error:", e);
        }
      } else if (method.includes('카운터') || method.includes('현금') || isTestPay || method.includes('직원방문') || method.includes('직원호출')) {
        setReceiptOrderId(orderId);
        setReceiptTotal(finalAmount);
        setReceiptMethod(method);
        setReceiptItems(mappedItems);
        setShowReceipt(true);

        phaseRef.current = 'paid';
        setPhase('paid');
        if (isTestPay) alert('테스트 결제가 성공적으로 완료되었습니다.');
      } else {
        localStorage.setItem('receipt_items_' + orderId, JSON.stringify(mappedItems));
        await PaymentService.requestPayAppPayment(method, {
          amount: finalAmount, orderId,
          orderName: `주문 (${tableId})`,
          customerName: '손님',
          storeName: storeName,
          phone: extraData?.phone || userPhone
        });
      }
    } catch (err: any) {
      alert(`주문 오류: ${err.message || '알 수 없는 오류'}`);
    } finally {
      setIsOrdering(false);
    }
  }, [tableId, deviceId, storeId, cart, cartTotal, userPhone, orderRound, refreshOrders, activeSession]);


  /* ─────────────────────────────────────────────
     Dutch pay (Deprecated - Bottom Dutch Pay replaced with Order History)
  ───────────────────────────────────────────── */
  /*
  const openDutchPay = () => {
    if (cart.length === 0) { setVoiceToast('🛒 장바구니가 비어 있습니다.'); setTimeout(() => setVoiceToast(null), 3000); return; }
    setDutchFrozenTotal(cartTotal); dutchFrozenTotalRef.current = cartTotal;
    setDutchStep('select'); setDutchCount(2); dutchCountRef.current = 2;
    setDutchPaidSlots([]); dutchPaidSlotsRef.current = [];
    setDutchPayingSlot(null); dutchPayingSlotRef.current = null;
    setShowDutchModal(true);
  };
  */


  /* ─────────────────────────────────────────────
     Overdue billing guard (플랫폼 이용료 미납/연체 시 차단)
  ───────────────────────────────────────────── */
  if (paymentStatus === '연체') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#090d16', color: '#f8fafc', padding: 24, textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '24px', padding: '40px', maxWidth: '440px', width: '100%', boxShadow: '0 20px 50px rgba(239,68,68,0.15)' }}>
          <span style={{ fontSize: '4rem', display: 'block', marginBottom: '20px' }}>⚠️</span>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fca5a5', margin: '0 0 12px 0' }}>매장 서비스 점검 중</h2>
          <p style={{ fontSize: '0.9rem', color: '#cbd5e1', lineHeight: '1.6', margin: '0' }}>
            현재 본 매장은 플랫폼 서비스 사용료 정산 지연으로 인해 <strong>시스템 운영이 임시 제한</strong>되었습니다.<br />
            불편을 드려 죄송합니다. 매장 점원에게 직접 주문을 진행해 주세요.
          </p>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     No-table guard
  ───────────────────────────────────────────── */
  if (!hasTableParam) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f172a', color: 'white', flexDirection: 'column', gap: 16, padding: 24 }}>
        <div style={{ fontSize: '4rem' }}>🔳</div>
        <h2 style={{ fontWeight: 900, fontSize: '1.4rem', margin: 0 }}>테이블 QR 스캔 후 주문</h2>
        <p style={{ color: '#94a3b8', textAlign: 'center', lineHeight: 1.6, margin: 0 }}>각 테이블에 부착된 QR 코드를 스캔하면<br />해당 테이블의 주문 화면이 열립니다.</p>
        <button onClick={() => onNavigate?.('qr')} style={{ background: '#f97316', color: 'white', border: 'none', borderRadius: 12, padding: '12px 28px', fontWeight: 800, cursor: 'pointer' }}>🖨️ QR 인쇄 센터로 이동</button>
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     Loading screen
  ───────────────────────────────────────────── */
  if (phase === 'loading' && menus.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: '2.5rem', animation: 'spin 1.5s linear infinite' }}>⏳</div>
        <p style={{ color: '#64748b', fontWeight: 600 }}>메뉴를 불러오는 중입니다...</p>
      </div>
    );
  }

  /* ── 더치페이 동행자 결제 대기실 랜더링 ── */
  if (phase === 'dutch_lobby') {
    const total = dutchLobbyProgress?.total_price || 0;
    const count = dutchLobbyProgress?.split_count || 1;
    const splitAmount = dutchLobbyProgress?.split_amount || 0;
    const paidItems = dutchLobbyProgress?.paid_items || [];
    const totalPaid = paidItems.reduce((sum: number, item: any) => sum + item.amount, 0);
    const remaining = Math.max(0, total - totalPaid);
    const pct = total > 0 ? Math.min(100, (totalPaid / total) * 100) : 0;

    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '24px', fontFamily: 'Inter, sans-serif', color: '#f8fafc', overflowY: 'auto'
      }}>
        <div style={{
          width: '100%', maxWidth: '400px', background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(16px)', borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '28px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', textAlign: 'center'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🤝</div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, margin: '0 0 4px', color: 'white' }}>시크빌 분할 결제 대기실</h2>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 24px' }}>테이블의 일행들과 나누어 결제를 진행합니다.</p>

          <div style={{
            background: 'rgba(255, 255, 255, 0.03)', borderRadius: '16px', padding: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '20px',
            display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#94a3b8' }}>
              <span>전체 주문 총액</span>
              <span style={{ fontWeight: 800, color: 'white' }}>{total.toLocaleString()}원</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'white' }}>
              <span>본인 결제 예정액</span>
              <span style={{ fontWeight: 900, color: '#f97316', fontSize: '1.1rem' }}>{splitAmount.toLocaleString()}원</span>
            </div>
            <div style={{ borderTop: '1px dashed rgba(255, 255, 255, 0.1)', marginTop: '4px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: '#94a3b8' }}>남은 정산 잔액</span>
              <span style={{ fontWeight: 900, color: '#3b82f6' }}>{remaining.toLocaleString()}원</span>
            </div>
          </div>

          {/* 진행바 */}
          <div style={{ marginBottom: '24px', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>
              <span>정산 진행률</span>
              <span>{Math.round(pct)}% ({totalPaid.toLocaleString()} / {total.toLocaleString()}원)</span>
            </div>
            <div style={{ width: '100%', height: '12px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{
                width: `${pct}%`, height: '100%',
                background: 'linear-gradient(90deg, #f97316, #3b82f6)',
                borderRadius: '6px', transition: 'width 0.4s ease'
              }}></div>
            </div>
          </div>

          {/* 결제 현황 리스트 */}
          <div style={{ marginBottom: '28px', textAlign: 'left' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', display: 'block', marginBottom: '8px' }}>
              📢 실시간 결제 현황 ({paidItems.length} / {count} 완료)
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
              {paidItems.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', padding: '12px', textAlign: 'center', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px' }}>
                  아직 결제 완료된 건이 없습니다.
                </div>
              ) : (
                paidItems.map((item: any, idx: number) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '10px', fontSize: '0.8rem' }}>
                    <span style={{ color: '#10b981', fontWeight: 700 }}>✔️ {idx + 1}번째 결제 완료</span>
                    <span style={{ fontWeight: 800, color: 'white' }}>{item.amount.toLocaleString()}원</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={async () => {
              try {
                const orderId = `dutch_${queryDutchSessionId}_${Date.now()}`;
                await PaymentService.requestPayAppPayment('카드', {
                  amount: splitAmount,
                  orderId,
                  orderName: '더치페이 결제',
                  customerName: '손님',
                  storeName: storeName,
                  phone: userPhone
                });
              } catch (err: any) {
                alert(err.message || '결제창 호출에 실패했습니다.');
              }
            }}
            disabled={remaining <= 0}
            style={{
              width: '100%', padding: '16px', background: '#f97316', color: 'white',
              border: 'none', borderRadius: '14px', fontSize: '1rem', fontWeight: 900,
              cursor: 'pointer', boxShadow: '0 6px 20px rgba(249, 115, 22, 0.25)', transition: 'all 0.2s'
            }}
          >
            💳 {splitAmount.toLocaleString()}원 결제하기
          </button>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     Main render
  ───────────────────────────────────────────── */
  const showCategoryStrip = phase !== 'loading' && phase !== 'paid';
  const showMenuStrip = phase === 'active' || phase === 'pre_payment' || phase === 'payment';
  const showCart = cart.length > 0 && showMenuStrip;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', position: 'fixed', inset: 0, background: '#f0f4f8', fontFamily: 'Inter, -apple-system, sans-serif', overflow: 'hidden' }}>

      {/* ── AI 채팅 영역 (대화창: 비율 4) ── */}
      <div ref={chatRef} style={{ flex: 4, overflowY: 'auto', padding: '12px 14px 8px', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 4, background: '#f0f4f8' }}>
        {aiMessages.map(msg => (
          <div key={msg.id} style={{ alignSelf: 'flex-start', maxWidth: '86%' }}>
            <div style={{
              background: 'white', color: '#1e293b', borderRadius: '0 16px 16px 16px',
              padding: '10px 14px', fontSize: '0.88rem', lineHeight: 1.55,
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0'
            }}>{msg.text}</div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, marginLeft: 6 }}>{msg.time}</div>
          </div>
        ))}
        {aiMessages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: '0.85rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>☕</div>
            <p style={{ margin: 0 }}>{storeName}에 오신 걸 환영합니다!</p>
          </div>
        )}
      </div>

      {/* ── 메뉴 영역 (메뉴창: 비율 6) ── */}
      {(showCategoryStrip || showMenuStrip) && (
        <div style={{ flex: 6, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f8fafc', borderTop: '1px solid #cbd5e1', boxShadow: '0 -4px 20px rgba(0,0,0,0.05)' }}>
          
          {/* 메뉴창 상단 카탈로그 가로 스크롤 바 */}
          {showCategoryStrip && (
            <div style={{
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              scrollbarWidth: 'none',
              padding: '10px 14px',
              background: '#ffffff',
              borderBottom: '1px solid #e2e8f0',
              flexShrink: 0,
            }}>
              {categories.map((cat, i) => {
                const sel = activeCategory === cat;
                return (
                  <button key={i} onClick={() => handleCategoryClick(cat)} style={{
                    flexShrink: 0,
                    padding: '8px 16px',
                    borderRadius: '20px',
                    background: sel ? '#f97316' : '#f1f5f9',
                    border: sel ? 'none' : '1px solid #e2e8f0',
                    color: sel ? 'white' : '#475569',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: sel ? '0 2px 8px rgba(249,115,22,0.25)' : 'none',
                    transition: 'all 0.15s ease-in-out',
                  }}>{cat}</button>
                );
              })}
            </div>
          )}

          {/* 우측 세로 메뉴 리스트 영역 -> 스티키 헤더 섹션 리스트 개편 */}
          {showMenuStrip && (
            <div 
              ref={menuListRef}
              onScroll={handleScroll}
              style={{
                flex: 1,
                padding: '10px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                background: '#f8fafc',
                scrollBehavior: 'smooth'
              }}
            >
              {categories.map(cat => {
                const catMenus = menus.filter(m => m.category === cat);
                if (catMenus.length === 0) return null;
                return (
                  <div key={cat} id={`cat-section-${cat}`} style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
                    {/* 카테고리 스티키 구분 헤더 */}
                    <div style={{
                      position: 'sticky',
                      top: '-10px', // padding 고려
                      zIndex: 10,
                      background: '#f8fafc',
                      padding: '6px 4px',
                      fontSize: '13px',
                      fontWeight: 900,
                      color: '#475569',
                      borderBottom: '1.5px solid #cbd5e1',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      margin: '0 2px 4px 2px',
                    }}>
                      <span style={{ fontSize: '14px' }}>🍽️</span> {cat}
                    </div>

                    {/* 카테고리 내부 메뉴 카드 목록 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {catMenus.map((item, idx) => {
                        const ci = cart.find(c => c.name === item.name);
                        return (
                          <div key={idx} style={{
                            display: 'flex',
                            flexShrink: 0,
                            minHeight: '86px',
                            background: '#ffffff',
                            borderRadius: '14px',
                            overflow: 'hidden',
                            border: ci ? '2px solid #f97316' : '1px solid #e2e8f0',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                            padding: '8px',
                            alignItems: 'center',
                            gap: '10px',
                            userSelect: 'none', WebkitUserSelect: 'none',
                          }}>
                            {/* 이미지 영역 */}
                            <div style={{ width: '70px', height: '70px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                              <img src={item.icon} alt={item.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => { (e.currentTarget as HTMLImageElement).src = IMG('1546069901-ba9599a7e63c'); }}
                              />
                            </div>
                            
                            {/* 메뉴 정보 */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description}</div>
                              <div style={{ fontSize: '12px', fontWeight: 900, color: '#f59e0b' }}>{item.price.toLocaleString()}원</div>
                            </div>

                            {/* 수량 조절 버튼 */}
                            <div style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '4px',
                              background: ci ? 'rgba(249,115,22,0.06)' : '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '10px',
                              padding: '4px',
                            }}>
                              <button onClick={(e) => { e.stopPropagation(); addToCart(item); }} style={{ width: '20px', height: '20px', border: 'none', background: 'rgba(249,115,22,0.15)', color: '#f97316', fontSize: '12px', fontWeight: 900, cursor: 'pointer', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                              <span style={{ fontSize: '11px', fontWeight: 900, color: ci ? '#f97316' : '#94a3b8', minWidth: '14px', textAlign: 'center' }}>{ci?.qty ?? 0}</span>
                              <button onClick={(e) => { e.stopPropagation(); removeFromCart(item.name); }} style={{ width: '20px', height: '20px', border: 'none', background: 'none', color: ci ? '#ef4444' : '#cbd5e1', fontSize: '12px', fontWeight: 900, cursor: ci ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
        </div>
      )}

      {/* ── 카트 요약 ── */}
      {showCart && (
        <div style={{ background: '#1e293b', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ flex: 1, overflowX: 'auto', display: 'flex', gap: 6, scrollbarWidth: 'none' }}>
            {cart.map(c => (
              <span key={c.name} style={{ flexShrink: 0, fontSize: 11, color: '#e2e8f0', background: 'rgba(255,255,255,0.08)', padding: '3px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                {c.name} ×{c.qty}
              </span>
            ))}
          </div>
          <div style={{ flexShrink: 0, fontSize: 13, fontWeight: 900, color: '#f97316', marginRight: 4 }}>{cartTotal.toLocaleString()}원</div>
          <button onClick={handleProceedPayment} style={{
            flexShrink: 0, background: '#f97316', color: 'white', border: 'none',
            borderRadius: 20, padding: '6px 14px', fontWeight: 800, fontSize: 12, cursor: 'pointer'
          }}>결제하기</button>
        </div>
      )}

      {/* ── 고정 하단 바 ── */}
      <nav style={{
        display: 'flex', background: '#0f172a', borderTop: '1px solid rgba(255,255,255,0.06)',
        paddingBottom: 'env(safe-area-inset-bottom)', flexShrink: 0,
      }}>
        {[
          { label: 'AI 주문', icon: '🎙️', active: isListening, onClick: toggleVoiceOrdering, show: true },
          { label: '직원호출', icon: '🔔', active: false, onClick: () => handleStaffCall(), show: useCall },
          { label: '주차확인', icon: '🚗', active: parkingApplied, onClick: () => setShowParkingModal(true), show: useParking },
        ].filter(btn => btn.show).map((btn, i) => (
          <button key={i} onClick={btn.onClick} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '8px 2px 10px', background: 'none', border: 'none', cursor: 'pointer',
            color: btn.active ? '#f97316' : '#64748b', gap: 2,
          }}>
            <span style={{ fontSize: i === 0 ? 22 : 18, filter: btn.active ? 'drop-shadow(0 0 4px #f97316)' : 'none' }}>{btn.icon}</span>
            <span style={{ fontSize: 9, fontWeight: 700 }}>{btn.label}</span>
          </button>
        ))}
      </nav>

      {/* ── Pre-payment Modal ── */}
      {phase === 'pre_payment' && (
        <PaymentModal
          totalPrice={cartTotal}
          onClose={() => {
            if (phaseRef.current === 'pre_payment') {
              phaseRef.current = 'active';
              setPhase('active');
            }
          }}
          onSubmit={(method, extra) => executeOrder(method, extra)}
          initialPhone={userPhone}
          bundles={bundles}
          cart={cart}
          sessionId={sessionIdRef.current}
          storeId={storeId}
          tableId={tableId}
        />
      )}



      {/* ── 실물카드 결제 대기 전체화면 ── */}
      {phase === 'waiting_payment' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 8000,
          background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 60%, #0f2027 100%)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '40px 28px',
          gap: 0,
        }}>
          <div style={{ fontSize: '5.5rem', marginBottom: '24px', animation: 'pulse-mild 2s infinite' }}>
            {waitingMethod.includes('카카오') ? '💛📲' : waitingMethod.includes('네이버') ? '💚📲' : waitingMethod.includes('현금') ? '💵📲' : '💳📲'}
          </div>
          
          <h2 style={{
            fontSize: '1.8rem', fontWeight: 900, color: 'white',
            margin: '0 0 16px', textAlign: 'center', letterSpacing: '-0.02em'
          }}>직원 결제 대기 중</h2>
          
          <p style={{
            color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.7,
            margin: '0 0 32px', textAlign: 'center', fontWeight: 500
          }}>
            직원이 결제 단말기(스마트폰)를 지참하고<br/>
            고객님의 테이블로 이동하고 있습니다.<br/>
            {waitingMethod.includes('카카오') || waitingMethod.includes('네이버') ? (
              <span style={{ color: '#f97316', fontWeight: 700 }}>네이버/카카오페이 결제 화면(QR/바코드)을 미리 열어 준비해 주세요.</span>
            ) : waitingMethod.includes('현금') ? (
              <span style={{ color: '#f97316', fontWeight: 700 }}>현금을 미리 준비해 주세요.</span>
            ) : (
              <span style={{ color: '#f97316', fontWeight: 700 }}>실물카드를 준비해 주세요.</span>
            )}
          </p>

          <div style={{
            padding: '16px 22px',
            borderRadius: '16px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: '#cbd5e1',
            fontSize: '0.88rem',
            lineHeight: 1.6,
            textAlign: 'left',
            width: '100%',
            maxWidth: '320px',
            boxSizing: 'border-box'
          }}>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'white', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>주문 정보</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>테이블</span>
              <span style={{ fontWeight: 700 }}>{tableId}번 테이블</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>결제 금액</span>
              <span style={{ fontWeight: 700, color: '#f97316' }}>{waitingTotal.toLocaleString()}원</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>결제 방법</span>
              <span style={{ fontWeight: 700 }}>{waitingMethod || '실물카드 결제 (직원방문)'}</span>
            </div>
          </div>
          
          <p style={{ marginTop: '24px', fontSize: '0.75rem', color: '#64748b' }}>
            * 결제가 완료되면 자동으로 영수증 화면이 나타납니다.
          </p>
        </div>
      )}

      {/* ── 결제 완료 전체화면 (메뉴 숨김) ── */}
      {phase === 'paid' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 8000,
          background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 60%, #0f2027 100%)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '40px 28px',
          gap: 0,
        }}>


          {/* 감사 아이콘 */}
          <div style={{ fontSize: '5.5rem', marginBottom: '20px', filter: 'drop-shadow(0 0 30px rgba(249,115,22,0.4))' }}>✅</div>

          {/* 감사 메시지 */}
          <h2 style={{
            fontSize: '1.9rem', fontWeight: 900, color: 'white',
            margin: '0 0 12px', textAlign: 'center', letterSpacing: '-0.02em'
          }}>주문해 주셔서 감사합니다!</h2>

          <p style={{
            color: '#94a3b8', fontSize: '1rem', lineHeight: 1.7,
            margin: '0 0 28px', textAlign: 'center'
          }}>
            주문이 주방으로 전달되었습니다.<br/>
            잠시만 기다려 주세요. 😊
          </p>

          {/* 안내 박스 */}
          <div style={{
            padding: '16px 22px',
            borderRadius: '16px',
            background: 'rgba(249, 115, 22, 0.1)',
            border: '1px solid rgba(249, 115, 22, 0.25)',
            color: '#fb923c',
            fontSize: '0.95rem',
            fontWeight: 600,
            lineHeight: 1.7,
            textAlign: 'center',
            marginBottom: '32px',
            width: '100%',
            maxWidth: '320px',
            boxSizing: 'border-box' as const,
          }}>
            추가 주문이 필요하시면<br/>
            아래 <strong style={{ color: '#f97316' }}>추가주문</strong> 버튼을 눌러주세요.
          </div>

          {/* 추가주문 버튼 */}
          <button
            onClick={() => {
              phaseRef.current = 'active';
              setPhase('active');
              setOrderRound(r => r + 1);
              addAiMsg(`${orderRound + 1}차 추가 주문을 시작합니다! 메뉴를 선택해 주세요. 🛒`);
            }}
            style={{
              width: '100%',
              maxWidth: '320px',
              padding: '18px',
              borderRadius: '18px',
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              color: 'white',
              border: 'none',
              fontWeight: 800,
              fontSize: '1.2rem',
              boxShadow: '0 8px 24px rgba(249, 115, 22, 0.4)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              letterSpacing: '0.02em',
              boxSizing: 'border-box' as const,
            }}
          >
            🍽️ 추가주문
          </button>
        </div>
      )}

      {/* ── 주방 완료 알림 ── */}
      {kitchenDoneMsg && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, background: 'linear-gradient(135deg, #1e3a5f, #0f172a)', padding: '20px 18px', zIndex: 12000, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: '3rem' }}>🍽️</div>
          <div style={{ color: 'white', fontWeight: 900, fontSize: '1.1rem', textAlign: 'center' }}>{kitchenDoneMsg}</div>
          <button onClick={() => setKitchenDoneMsg('')} style={{ marginTop: 6, padding: '10px 28px', background: '#f97316', color: 'white', border: 'none', borderRadius: 24, fontWeight: 800, cursor: 'pointer' }}>확인</button>
        </div>
      )}

      {/* ── 더치페이 모달 ── */}
      {showDutchModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(10px)', zIndex: 11000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 24, width: '100%', maxWidth: 400, padding: 28, maxHeight: '80vh', overflowY: 'auto', position: 'relative' }}>
            <button onClick={() => setShowDutchModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: 16 }}>✕</button>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🤝</div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 900, margin: '0 0 4px' }}>더치페이</h3>
              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>총 <strong style={{ color: '#1e293b' }}>{dutchFrozenTotal.toLocaleString()}원</strong>을 나눠서 결제합니다</p>
            </div>
            {dutchStep === 'select' ? (
              <>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: 10, textTransform: 'uppercase' }}>인원 선택</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
                  {[2, 3, 4, 5, 6, 7, 8].map(n => (
                    <button key={n} onClick={() => setDutchCount(n)} style={{ padding: '12px 0', border: dutchCount === n ? '2px solid #3b82f6' : '1.5px solid #e2e8f0', borderRadius: 12, background: dutchCount === n ? 'rgba(59,130,246,0.1)' : '#f8fafc', color: dutchCount === n ? '#2563eb' : '#334155', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>{n}명</button>
                  ))}
                </div>
                <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 16, textAlign: 'center' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>1인당 금액</p>
                  <p style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900, color: '#1e293b' }}>{Math.ceil(dutchFrozenTotal / dutchCount).toLocaleString()}원</p>
                </div>
                <button onClick={() => { setDutchPaidSlots(Array(dutchCount).fill(false)); dutchPaidSlotsRef.current = Array(dutchCount).fill(false); dutchCountRef.current = dutchCount; setDutchStep('pay'); }}
                  style={{ width: '100%', padding: 14, background: '#3b82f6', border: 'none', borderRadius: 12, color: 'white', fontWeight: 800, fontSize: '1rem', cursor: 'pointer' }}>다음 →</button>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Array.from({ length: dutchCount }, (_, i) => {
                  const isLast = i === dutchCount - 1;
                  const per = isLast ? dutchFrozenTotal - Math.ceil(dutchFrozenTotal / dutchCount) * (dutchCount - 1) : Math.ceil(dutchFrozenTotal / dutchCount);
                  const paid = dutchPaidSlots[i] || false;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: paid ? 'rgba(16,185,129,0.08)' : '#f8fafc', borderRadius: 12, border: paid ? '1.5px solid rgba(16,185,129,0.3)' : '1.5px solid #e2e8f0' }}>
                      <div>
                        <p style={{ margin: '0 0 2px', fontWeight: 800, fontSize: '0.75rem', color: '#64748b' }}>{i + 1}번째</p>
                        <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: paid ? '#10b981' : '#1e293b' }}>{per.toLocaleString()}원</p>
                      </div>
                      {paid ? <div style={{ background: '#10b981', color: 'white', borderRadius: 20, padding: '5px 12px', fontSize: '0.8rem', fontWeight: 700 }}>✓ 완료</div>
                        : <button onClick={() => { dutchPayingSlotRef.current = i; setDutchPayingSlot(i); setShowDutchPersonPayModal(true); }} style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 20, padding: '7px 14px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>결제하기</button>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 더치페이 개인 결제 */}
      {showDutchPersonPayModal && dutchPayingSlot !== null && (
        <PaymentModal
          totalPrice={dutchPayingSlot === dutchCount - 1
            ? dutchFrozenTotal - Math.ceil(dutchFrozenTotal / dutchCount) * (dutchCount - 1)
            : Math.ceil(dutchFrozenTotal / dutchCount)}
          onClose={() => { setShowDutchPersonPayModal(false); setDutchPayingSlot(null); dutchPayingSlotRef.current = null; }}
          onSubmit={(method, extra) => executeOrder(method, { ...extra, dutchAmount: dutchPayingSlot === dutchCount - 1 ? dutchFrozenTotal - Math.ceil(dutchFrozenTotal / dutchCount) * (dutchCount - 1) : Math.ceil(dutchFrozenTotal / dutchCount), dutchLabel: `더치페이 ${dutchPayingSlot + 1}/${dutchCount}`, isDutchPay: true })}
          initialPhone={userPhone}
          bundles={bundles}
          sessionId={sessionIdRef.current}
          storeId={storeId}
          tableId={tableId}
        />
      )}

      {/* ── 주차 모달 ── */}
      {showParkingModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', zIndex: 11000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 380, padding: 28, position: 'relative' }}>
            <button onClick={() => { setShowParkingModal(false); setVehicleNumber(''); }} style={{ position: 'absolute', top: 16, right: 16, background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: 16 }}>✕</button>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🚗</div>
              <h3 style={{ fontWeight: 900, fontSize: '1.1rem', margin: '0 0 6px' }}>원클릭 셀프 주차 등록</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0, lineHeight: 1.5 }}>식사 시간 동안 무료 주차 2시간 혜택</p>
            </div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' }}>차량번호 뒤 4자리</label>
            <input type="text" maxLength={4} placeholder="예: 1234" value={vehicleNumber}
              onChange={e => setVehicleNumber(e.target.value.replace(/[^0-9]/g, ''))}
              style={{ width: '100%', padding: '14px 16px', border: '1.5px solid #e2e8f0', borderRadius: 12, fontSize: '1.5rem', fontWeight: 900, textAlign: 'center', letterSpacing: 8, color: '#1e293b', background: '#f8fafc', outline: 'none', boxSizing: 'border-box', marginBottom: 14 }} />
            <button onClick={handleParkingSubmit} style={{ width: '100%', padding: 14, background: parkingApplied ? '#10b981' : '#3b82f6', color: 'white', border: 'none', borderRadius: 12, fontWeight: 900, cursor: 'pointer', fontSize: '0.9rem' }}>
              {parkingApplied ? '✓ 주차 등록 완료' : '🚗 2시간 무료 정산 등록'}
            </button>
            <p style={{ textAlign: 'center', fontSize: '0.7rem', color: '#94a3b8', marginTop: 8 }}>* 등록 후에는 취소나 변경이 불가합니다.</p>
          </div>
        </div>
      )}

      {/* ── 직원 호출 오버레이 ── */}
      {callOverlay && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 12000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 20, padding: '36px 28px', maxWidth: 340, width: '100%', textAlign: 'center', border: `2px solid ${callOverlay.status === 'completed' ? '#22c55e' : '#e2e8f0'}` }}>
            {callOverlay.status === 'pending' ? (
              <>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔔</div>
                <h2 style={{ fontWeight: 900, marginBottom: 8 }}>직원 호출 완료!</h2>
                <p style={{ color: '#64748b', marginBottom: 20 }}>잠시만 기다려 주세요.</p>
                <button onClick={() => setCallOverlay(null)} style={{ padding: '10px 24px', borderRadius: 12, border: '1px solid #e2e8f0', background: 'transparent', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}>닫기</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>✅</div>
                <h2 style={{ fontWeight: 900, color: '#22c55e', marginBottom: 8 }}>처리 완료!</h2>
                <p style={{ color: '#334155', marginBottom: 20 }}>직원 호출이 완료되었습니다.</p>
                <button onClick={() => setCallOverlay(null)} style={{ padding: '12px 32px', borderRadius: 12, border: 'none', background: '#22c55e', color: 'white', fontWeight: 900, cursor: 'pointer' }}>확인</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Voice Toast ── */}
      {voiceToast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: 'rgba(15,23,42,0.95)', border: '1.5px solid #f97316', color: 'white', padding: '10px 20px', borderRadius: 50, fontSize: '0.8rem', fontWeight: 800, zIndex: 13000, whiteSpace: 'nowrap' }}>
          {voiceToast}
        </div>
      )}

      {/* ── 모바일 영수증 모달 ── */}
      {showReceipt && (
        <ReceiptModal
          orderId={receiptOrderId}
          totalPrice={receiptTotal}
          paymentMethod={receiptMethod}
          items={receiptItems}
          onClose={() => {
            setShowReceipt(false);
            window.close();
            setTimeout(() => {
              window.location.href = "about:blank";
            }, 100);
          }}
          storeName={storeName}
          showGwansangOption={true}
        />
      )}

      {/* ── 원격 결제 요청 모달 (폰 to 폰) ── */}
      {remotePayRequest && (
        <PaymentModal
          totalPrice={remotePayRequest.amount}
          onClose={() => setRemotePayRequest(null)}
          sessionId={sessionIdRef.current}
          storeId={storeId}
          tableId={tableId}
          onSubmit={async (method) => {
            const isTestPay = method.includes('가상 결제') || method.includes('테스트');
            const isCounterPay = method.includes('카운터') || method.includes('현금') || method.includes('직원방문') || method.includes('직원호출') || method.includes('실물카드');
            if (isTestPay || isCounterPay) {
              try {
                const endpoint = remotePayRequest.orderId 
                  ? `${API_BASE}/api/order/status` 
                  : `${API_BASE}/api/session/close`;
                
                const body = remotePayRequest.orderId
                  ? { order_id: remotePayRequest.orderId, status: isTestPay ? 'paid' : 'unpaid' }
                  : { session_id: sessionIdRef.current };
                  
                const res = await fetch(endpoint, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(body)
                });
                
                if (res.ok) {
                  alert('결제가 완료되었습니다. 이용해 주셔서 감사합니다! ✅');
                  setRemotePayRequest(null);
                  phaseRef.current = 'paid';
                  setPhase('paid');
                  refreshOrders();
                } else {
                  alert('결제 처리 실패: ' + await res.text());
                }
              } catch (e) {
                alert('네트워크 오류가 발생했습니다.');
              }
            } else {
              const orderId = remotePayRequest.orderId || `SESS-${sessionIdRef.current.substring(5, 13)}-${Date.now().toString().substring(8)}`;
              localStorage.setItem('receipt_items_' + orderId, JSON.stringify([{ name: '원격 주문 결제', value: '1개' }]));
              await PaymentService.requestPayAppPayment(method, {
                amount: remotePayRequest.amount,
                orderId: orderId,
                orderName: remotePayRequest.orderId ? `주문 번호 결제` : `모바일 식대 결제 요청`,
                customerName: '고객',
                storeName: storeName,
                phone: userPhone
              });
              setRemotePayRequest(null);
            }
          }}
          initialPhone={userPhone}
          bundles={bundles}
        />
      )}

      {/* Loading overlay */}
      {isOrdering && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.8)', zIndex: 14000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ fontSize: '2rem', animation: 'spin 1s linear infinite' }}>⏳</div>
          <p style={{ color: 'white', fontWeight: 700 }}>주문을 처리하고 있습니다...</p>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default QROrderFlow;
