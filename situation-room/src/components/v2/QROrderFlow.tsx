import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { API_BASE } from '../../config';
import { subscribeTopic } from '../../services/mqttClient';
import { subscribeToStore } from '../../services/notifications';
import { PaymentModal } from '../PaymentModal';
import { PaymentService } from '../../services/paymentService';
import type { BundleData } from '../../types';

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
type FlowPhase =
  | 'loading'           // 메뉴 로딩 + 세션 확인
  | 'greeting'          // AI 인사 + 카테고리 스트립, 승인 대기
  | 'waiting_approval'  // 카운터 승인 명시적 대기
  | 'active'            // 세션 활성 → 메뉴 스트립 + 카트
  | 'pre_payment'       // 포인트·영수증·주차 확인
  | 'payment'           // 결제 진행
  | 'paid';             // 결제 완료

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
function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ko-KR'; u.rate = 1.05;
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

  const categories = useMemo(() => ['전체', ...Array.from(new Set(menus.map(m => m.category)))], [menus]);

  /* ── Core state ── */
  const [phase, setPhase] = useState<FlowPhase>('loading');
  const [activeCategory, setActiveCategory] = useState('전체');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [aiMessages, setAiMessages] = useState<AiMsg[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [allOrders, setAllOrders] = useState<Order[]>([]);  // 전체 주문 누적
  const [orderRound, setOrderRound] = useState(1);          // 몇 차 주문

  /* ── Pre-payment state ── */
  const [userPhone, setUserPhone] = useState('');
  const [cashReceipt, setCashReceipt] = useState<'personal' | 'business' | 'none'>('none');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [parkingWanted, setParkingWanted] = useState(false);
  const [parkingApplied, setParkingApplied] = useState(false);
  const [selectedPayMethod, setSelectedPayMethod] = useState('');

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

  /* ── Refs ── */
  const sessionIdRef = useRef('');
  const phaseRef = useRef<FlowPhase>('loading');
  const catScrollRef = useRef<HTMLDivElement>(null);
  const menuScrollRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const dutchPayingSlotRef = useRef<number | null>(null);
  const dutchPaidSlotsRef = useRef<boolean[]>([]);
  const dutchCountRef = useRef(2);
  const dutchFrozenTotalRef = useRef(0);

  useEffect(() => { dutchPaidSlotsRef.current = dutchPaidSlots; }, [dutchPaidSlots]);
  useEffect(() => { dutchCountRef.current = dutchCount; }, [dutchCount]);
  useEffect(() => { dutchFrozenTotalRef.current = dutchFrozenTotal; }, [dutchFrozenTotal]);

  /* ── Computed ── */
  const cartTotal = useMemo(() => cart.reduce((s, c) => s + c.price * c.qty, 0), [cart]);
  const filteredMenus = useMemo(() =>
    menus.filter(m => activeCategory === '전체' || m.category === activeCategory), [menus, activeCategory]);

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

  const activateSession = useCallback((sid: string, orders: Order[] = []) => {
    sessionIdRef.current = sid;
    setAllOrders(orders);
    phaseRef.current = 'active';
    setPhase('active');
  }, []);

  const joinSession = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/checkin/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableNo, deviceId, store: storeName, store_id: storeId })
      });
      const data = await res.json();
      if (data.status === 'active') {
        activateSession(data.session?.session_id || '', data.orders || []);
      } else if (data.status === 'waiting_approval') {
        phaseRef.current = 'waiting_approval';
        setPhase('waiting_approval');
      } else {
        // 세션 없음 → greeting으로 진입 (카테고리 스트립은 보임, 메뉴는 숨김)
        phaseRef.current = 'greeting';
        setPhase('greeting');
      }
    } catch (_) {
      phaseRef.current = 'greeting';
      setPhase('greeting');
    }
  }, [tableNo, deviceId, storeName, storeId, activateSession]);

  /* ─────────────────────────────────────────────
     MQTT subscriptions + 초기화
  ───────────────────────────────────────────── */
  useEffect(() => {
    const unsub = subscribeTopic(`situation/table/${tableId}`, (msg: any) => {
      switch (msg.type) {
        case 'SESSION_OPENED':
          joinSession();
          break;
        case 'SESSION_CLOSED':
          sessionIdRef.current = '';
          phaseRef.current = 'greeting'; setPhase('greeting');
          setCart([]); setAllOrders([]);
          addAiMsg('세션이 종료되었습니다. 이용해 주셔서 감사합니다! 😊', true);
          break;
        case 'JOIN_RESPONSE':
          if (msg.device_id === deviceId) {
            if (msg.approved) {
              activateSession(msg.session_id, []);
              refreshOrders();
              addAiMsg(`합석이 승인되었습니다. ${orderRound + 1}차 주문을 시작할 수 있습니다!`);
              setOrderRound(r => r + 1);
            } else {
              addAiMsg('합석이 거부되었습니다. 카운터에 문의해 주세요.');
            }
          }
          break;
        case 'ORDER_READY':
          playDing();
          setKitchenDoneMsg('주문하신 음식이 나왔습니다! 즐거운 식사 되세요 🍽️');
          addAiMsg('주문하신 음식이 나왔습니다! 즐거운 식사 되세요. 🍽️');
          break;
        case 'STAFF_RESPONSE':
          setCallOverlay(prev => prev ? { ...prev, status: 'completed' } : null);
          addAiMsg('직원이 곧 방문합니다.', false);
          break;
        case 'PARKING_CONFIRMED':
          addAiMsg('주차 할인이 정상 등록되었습니다. 🚗', false);
          break;
        case 'POINT_CONFIRMED':
          addAiMsg('포인트가 정상 적립되었습니다. 🎁', false);
          break;
        default:
          refreshOrders();
      }
    });

    const callUnsub = subscribeToStore(storeId, (data: any) => {
      if (callOverlay && data.type === 'CALL_STATUS_UPDATED' && data.call_id === callOverlay.callId) {
        playDing();
        setCallOverlay(prev => prev ? { ...prev, status: 'completed' } : null);
      }
    });

    return () => { unsub(); callUnsub(); };
  }, [tableId, storeId, deviceId, joinSession, activateSession, refreshOrders, addAiMsg, orderRound, callOverlay]);

  /* ── 최초 진입 ── */
  useEffect(() => {
    if (!hasTableParam) return;
    // 메뉴가 로드되면 세션 확인 + AI 인사
    if (menus.length > 0 && phase === 'loading') {
      joinSession().then(() => {
        setTimeout(() => {
          addAiMsg(
            `안녕하세요! 저는 ${storeName} AI 도우미입니다. 😊 위 카테고리를 눌러 메뉴를 보시고, 사진 아래 [+] 버튼이나 🎙️ 음성 주문 버튼으로 편하게 주문하세요!`,
            true
          );
          // loading 단계이면 greeting으로
          if (phaseRef.current === 'loading') {
            phaseRef.current = 'greeting'; setPhase('greeting');
          }
        }, 600);
      });
    }
  }, [menus.length, hasTableParam]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Phase별 AI 멘트 ── */
  useEffect(() => {
    if (phase === 'waiting_approval') {
      addAiMsg('카운터에서 좌석을 확인 중입니다. 잠시만 기다려 주세요. ⏳');
    } else if (phase === 'active' && phaseRef.current !== 'active') {
      addAiMsg('좌석 승인이 완료되었습니다! 원하시는 메뉴를 선택해 주세요. 🛒');
    } else if (phase === 'paid') {
      addAiMsg('결제가 완료되었습니다! 맛있게 드세요. 🎉 추가 주문은 하단 [추가주문] 버튼을 이용하세요.');
    }
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─────────────────────────────────────────────
     Payment result event
  ───────────────────────────────────────────── */
  useEffect(() => {
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
        }
        return;
      }
      setCart([]);
      refreshOrders();
      phaseRef.current = 'paid'; setPhase('paid');
    };

    // URL success flag (Toss redirect 후 돌아온 경우)
    if (new URLSearchParams(window.location.search).get('payment_success') === 'true'
      || localStorage.getItem('payment_success_flag') === 'true') {
      localStorage.removeItem('payment_success_flag');
      setCart([]); refreshOrders();
      phaseRef.current = 'paid'; setPhase('paid');
    }

    window.addEventListener('payment_finished', handleFinished);
    return () => window.removeEventListener('payment_finished', handleFinished);
  }, [refreshOrders]);

  /* ─────────────────────────────────────────────
     Cart actions
  ───────────────────────────────────────────── */
  const addToCart = useCallback((item: MenuItem) => {
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
      const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
      const res = await fetch(`${apiUrl}/api/call`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id: tableId, store_id: storeId, call_type: callType })
      });
      if (res.ok) {
        const d = await res.json();
        setCallOverlay({ callId: d.call_id, status: 'pending' });
        addAiMsg('직원 호출 완료! 곧 방문합니다. 🔔', false);
      }
    } catch (_) { setVoiceToast('❌ 호출 실패. 카운터로 직접 문의해 주세요.'); setTimeout(() => setVoiceToast(null), 3000); }
  }, [tableId, storeId, addAiMsg]);

  /* ─────────────────────────────────────────────
     Parking submit
  ───────────────────────────────────────────── */
  const handleParkingSubmit = async () => {
    if (vehicleNumber.trim().length < 4) { setVoiceToast('차량번호 뒤 4자리를 입력해주세요.'); setTimeout(() => setVoiceToast(null), 3000); return; }
    try {
      const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
      const res = await fetch(`${apiUrl}/api/parking/validate`, {
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
  }, [cart, addAiMsg]);

  const executeOrder = useCallback(async (method: string, extraData?: any) => {
    setIsOrdering(true);
    try {
      const finalAmount = extraData?.dutchAmount !== undefined ? extraData.dutchAmount : cartTotal - (extraData?.usePoints || 0);
      const res = await fetch(`${API_BASE}/api/order/direct`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: tableId, device_id: deviceId, store_id: storeId,
          items: cart.map(c => ({ name: c.name, quantity: c.qty, price: c.price, qty: c.qty })),
          total_price: finalAmount,
          payment_status: (method.includes('카운터') || method.includes('현금')) ? 'unpaid' : 'pending',
          payment_method: method,
          metadata: { ...extraData, cash_receipt: cashReceipt, phone: userPhone, round: orderRound }
        })
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || '주문 생성 실패'); }
      const orderData = await res.json();
      const orderId = orderData.order_id;

      if (method.includes('카운터') || method.includes('현금')) {
        setCart([]); refreshOrders();
        phaseRef.current = 'paid'; setPhase('paid');
      } else {
        localStorage.setItem('receipt_items_' + orderId, JSON.stringify(cart.map(c => ({ name: c.name, value: `${c.qty}개` }))));
        await PaymentService.requestTossPayment(method, {
          amount: finalAmount, orderId,
          orderName: extraData?.dutchLabel || `${cart[0].name}${cart.length > 1 ? ` 외 ${cart.length - 1}건` : ''}`,
          customerName: '손님'
        });
      }
    } catch (err: any) {
      alert(`주문 오류: ${err.message || '알 수 없는 오류'}`);
    } finally {
      setIsOrdering(false);
    }
  }, [tableId, deviceId, storeId, cart, cartTotal, cashReceipt, userPhone, orderRound, refreshOrders]);

  /* ─────────────────────────────────────────────
     Dutch pay
  ───────────────────────────────────────────── */
  const openDutchPay = () => {
    if (cart.length === 0) { setVoiceToast('🛒 장바구니가 비어 있습니다.'); setTimeout(() => setVoiceToast(null), 3000); return; }
    setDutchFrozenTotal(cartTotal); dutchFrozenTotalRef.current = cartTotal;
    setDutchStep('select'); setDutchCount(2); dutchCountRef.current = 2;
    setDutchPaidSlots([]); dutchPaidSlotsRef.current = [];
    setDutchPayingSlot(null); dutchPayingSlotRef.current = null;
    setShowDutchModal(true);
  };

  /* ─────────────────────────────────────────────
     Styles
  ───────────────────────────────────────────── */
  const arrowBtn: React.CSSProperties = {
    flexShrink: 0, width: 24, height: 24,
    background: '#f1f5f9', border: '1.5px solid #cbd5e1',
    borderRadius: '50%', color: '#475569', fontSize: 10,
    cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontWeight: 900, padding: 0, lineHeight: 1,
  };

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

  /* ─────────────────────────────────────────────
     Main render
  ───────────────────────────────────────────── */
  const showCategoryStrip = phase !== 'loading';
  const showMenuStrip = phase === 'active' || phase === 'pre_payment' || phase === 'payment' || phase === 'paid';
  const showCart = cart.length > 0 && showMenuStrip;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#f0f4f8', fontFamily: 'Inter, -apple-system, sans-serif', position: 'relative', overflow: 'hidden' }}>

      {/* ── AI 채팅 영역 ── */}
      <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 14px 8px', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 4 }}>
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

      {/* ── 카테고리 스크롤 ── */}
      {showCategoryStrip && (
        <div style={{ background: '#ffffff', padding: '6px 10px 5px', display: 'flex', alignItems: 'center', gap: 4, borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <button style={arrowBtn} onClick={() => catScrollRef.current?.scrollBy({ left: -110, behavior: 'smooth' })}>◀</button>
          <div ref={catScrollRef} style={{ flex: 1, display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', padding: '1px 0' }}>
            {categories.map((cat, i) => {
              const sel = activeCategory === cat;
              return (
                <button key={i} onClick={() => setActiveCategory(cat)} style={{
                  flexShrink: 0, padding: '4px 10px', borderRadius: 100,
                  background: sel ? '#f97316' : '#f1f5f9',
                  border: sel ? 'none' : '1.5px solid #e2e8f0',
                  color: sel ? 'white' : '#475569',
                  fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap', cursor: 'pointer',
                  boxShadow: sel ? '0 2px 8px rgba(249,115,22,0.28)' : 'none',
                }}>{cat}</button>
              );
            })}
          </div>
          <button style={arrowBtn} onClick={() => catScrollRef.current?.scrollBy({ left: 110, behavior: 'smooth' })}>▶</button>
        </div>
      )}

      {/* ── 승인 대기 배너 ── */}
      {phase === 'waiting_approval' && (
        <div style={{ background: '#fef3c7', borderBottom: '1px solid #fde68a', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 16 }}>⏳</span>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#92400e' }}>카운터에서 좌석을 확인 중입니다. 잠시만 기다려 주세요.</span>
        </div>
      )}

      {/* ── 메뉴 스크롤 ── */}
      {showMenuStrip && (
        <div style={{ background: '#ffffff', padding: '4px 10px 8px', borderBottom: '2px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button style={arrowBtn} onClick={() => menuScrollRef.current?.scrollBy({ left: -150, behavior: 'smooth' })}>◀</button>
          <div ref={menuScrollRef} style={{ flex: 1, display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', padding: '2px 0' }}>
            {filteredMenus.map((item, idx) => {
              const ci = cart.find(c => c.name === item.name);
              return (
                <div key={idx} style={{
                  flexShrink: 0, width: 132,
                  background: '#ffffff', borderRadius: 10, overflow: 'hidden',
                  border: ci ? '2px solid #f97316' : '1.5px solid #e2e8f0',
                  boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
                  userSelect: 'none', WebkitUserSelect: 'none',
                }}>
                  <div style={{ width: '100%', height: 99, cursor: 'pointer' }} onClick={() => addToCart(item)}>
                    <img src={item.icon} alt={item.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = IMG('1546069901-ba9599a7e63c'); }}
                    />
                  </div>
                  {/* 수량 바 */}
                  <div onClick={e => e.stopPropagation()} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: ci ? 'rgba(249,115,22,0.07)' : '#f8fafc',
                    borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', padding: '3px 5px',
                  }}>
                    <button onClick={() => removeFromCart(item.name)} style={{ width: 18, height: 18, border: 'none', background: 'none', color: ci ? '#ef4444' : '#cbd5e1', fontSize: 13, fontWeight: 900, cursor: ci ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1 }}>−</button>
                    <span style={{ fontSize: 12, fontWeight: 900, color: ci ? '#f97316' : '#94a3b8', minWidth: 16, textAlign: 'center' }}>{ci?.qty ?? 0}</span>
                    <button onClick={() => addToCart(item)} style={{ width: 18, height: 18, border: 'none', background: 'rgba(249,115,22,0.15)', color: '#f97316', fontSize: 13, fontWeight: 900, cursor: 'pointer', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1 }}>+</button>
                  </div>
                  {/* 이름 & 가격 */}
                  <div style={{ padding: '4px 6px 5px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                    <div style={{ fontSize: 11, fontWeight: 900, color: '#f59e0b' }}>{item.price.toLocaleString()}원</div>
                  </div>
                </div>
              );
            })}
          </div>
          <button style={arrowBtn} onClick={() => menuScrollRef.current?.scrollBy({ left: 150, behavior: 'smooth' })}>▶</button>
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
          { label: 'AI 주문', icon: '🎙️', active: isListening, onClick: toggleVoiceOrdering },
          { label: '추가주문', icon: '➕', active: false, onClick: () => { if (phase === 'paid') { phaseRef.current = 'active'; setPhase('active'); setOrderRound(r => r + 1); addAiMsg(`${orderRound + 1}차 주문을 시작합니다! 메뉴를 선택해 주세요.`); } } },
          { label: '직원호출', icon: '🔔', active: false, onClick: () => handleStaffCall() },
          { label: '주차확인', icon: '🚗', active: parkingApplied, onClick: () => setShowParkingModal(true) },
          { label: '더치페이', icon: '🤝', active: false, onClick: openDutchPay },
        ].map((btn, i) => (
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

      {/* ── Pre-payment Sheet ── */}
      {phase === 'pre_payment' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', zIndex: 9000, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ width: '100%', background: 'white', borderRadius: '20px 20px 0 0', padding: '24px 20px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ width: 36, height: 4, background: '#e2e8f0', borderRadius: 2, margin: '0 auto 20px' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', margin: '0 0 18px' }}>결제 전 확인</h3>

            {/* 주문 내역 */}
            <div style={{ background: '#f8fafc', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
              {cart.map(c => (
                <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '3px 0', color: '#334155' }}>
                  <span>{c.name} ×{c.qty}</span>
                  <span style={{ fontWeight: 700 }}>{(c.price * c.qty).toLocaleString()}원</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 900, color: '#f97316' }}>
                <span>합계</span><span>{cartTotal.toLocaleString()}원</span>
              </div>
            </div>

            {/* 포인트 적립 */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>포인트 적립 (선택)</label>
              <input type="tel" placeholder="휴대폰 번호 입력" value={userPhone}
                onChange={e => setUserPhone(e.target.value.replace(/[^0-9]/g, ''))}
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: '0.9rem', color: '#1e293b', background: '#f8fafc', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            {/* 현금영수증 (5만원 이상) */}
            {cartTotal >= 50000 && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>현금영수증</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['personal', 'business', 'none'] as const).map(v => (
                    <button key={v} onClick={() => setCashReceipt(v)} style={{
                      flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                      background: cashReceipt === v ? '#2563eb' : '#f1f5f9',
                      color: cashReceipt === v ? 'white' : '#475569',
                      border: cashReceipt === v ? 'none' : '1.5px solid #e2e8f0',
                    }}>{{ personal: '개인소득', business: '사업자', none: '미발행' }[v]}</button>
                  ))}
                </div>
              </div>
            )}

            {/* 주차 */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>주차 할인 (2시간)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setParkingWanted(true)} style={{ flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', background: parkingWanted ? '#059669' : '#f1f5f9', color: parkingWanted ? 'white' : '#475569', border: parkingWanted ? 'none' : '1.5px solid #e2e8f0' }}>주차했어요 🚗</button>
                <button onClick={() => setParkingWanted(false)} style={{ flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', background: !parkingWanted ? '#64748b' : '#f1f5f9', color: !parkingWanted ? 'white' : '#475569', border: !parkingWanted ? 'none' : '1.5px solid #e2e8f0' }}>해당없음</button>
              </div>
              {parkingWanted && !parkingApplied && (
                <div style={{ marginTop: 8 }}>
                  <input type="text" placeholder="차량번호 뒤 4자리" maxLength={4} value={vehicleNumber}
                    onChange={e => setVehicleNumber(e.target.value.replace(/[^0-9]/g, ''))}
                    style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: '0.9rem', textAlign: 'center', letterSpacing: 8, fontWeight: 800, color: '#1e293b', background: '#f8fafc', outline: 'none', boxSizing: 'border-box' }} />
                  <button onClick={handleParkingSubmit} style={{ width: '100%', marginTop: 6, padding: 10, background: '#059669', color: 'white', border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'pointer', fontSize: '0.88rem' }}>주차 등록</button>
                </div>
              )}
              {parkingApplied && <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: '#059669', fontWeight: 700 }}>✓ 주차 할인 신청 완료</p>}
            </div>

            {/* 결제 수단 */}
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>결제 수단</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {['신용카드', '토스페이', '카카오페이', '계좌이체', '카운터 결제'].map(m => (
                <button key={m} onClick={() => setSelectedPayMethod(m)} style={{
                  padding: '10px 8px', borderRadius: 10, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
                  background: selectedPayMethod === m ? '#2563eb' : '#f1f5f9',
                  color: selectedPayMethod === m ? 'white' : '#334155',
                  border: selectedPayMethod === m ? 'none' : '1.5px solid #e2e8f0',
                }}>{m}</button>
              ))}
            </div>

            <button onClick={() => {
              if (!selectedPayMethod) { setVoiceToast('결제 수단을 선택해 주세요.'); setTimeout(() => setVoiceToast(null), 2000); return; }
              phaseRef.current = 'payment'; setPhase('payment');
              executeOrder(selectedPayMethod, { usePoints: 0 });
            }} style={{
              width: '100%', padding: 14, background: '#f97316', color: 'white', border: 'none',
              borderRadius: 12, fontWeight: 900, fontSize: '1rem', cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(249,115,22,0.35)'
            }}>
              {cartTotal.toLocaleString()}원 결제하기
            </button>

            <button onClick={() => { phaseRef.current = 'active'; setPhase('active'); }} style={{ width: '100%', marginTop: 8, padding: 12, background: 'none', color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: 12, fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer' }}>
              메뉴 더 보기
            </button>
          </div>
        </div>
      )}

      {/* ── 결제 완료 화면 ── */}
      {phase === 'paid' && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', padding: '16px 14px', zIndex: 8000, borderBottom: '2px solid #a7f3d0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '2rem' }}>✅</span>
          <div>
            <div style={{ fontWeight: 900, fontSize: '0.95rem', color: '#065f46' }}>결제 완료!</div>
            <div style={{ fontSize: '0.8rem', color: '#059669', marginTop: 2 }}>
              주문 내역 {allOrders.length > 0 ? `(${allOrders.length}차)` : ''} | 추가 주문은 하단 [➕추가주문]을 이용하세요
            </div>
          </div>
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
                <p style={{ color: '#334155', marginBottom: 20 }}>직원이 곧 방문합니다.</p>
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
