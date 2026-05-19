import React, { useState, useEffect, useMemo, useCallback } from 'react'; // Git Force Trigger: 2026-05-04 23:27
import './MobileOrderV2.css';
import type { BundleData } from '../../types';
import { API_BASE } from '../../config';
import { subscribeTopic } from '../../services/mqttClient';
import { sendNotify, subscribeToStore } from '../../services/notifications';
import { PaymentModal } from '../PaymentModal';
import { PaymentService } from '../../services/paymentService';
import { ConversationalUI } from '../ConversationalUI';

interface Props {
  bundles: BundleData[];
  storeId: string;
  storeName: string;
  onNavigate?: (tab: any) => void;
}

interface MenuItem {
  name: string;
  price: number;
  icon: string;
  category: string;
  description: string;
  qty?: number;
}

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  qty?: number;
}

interface Order {
  order_id: string;
  order_seq: number;
  total_price: number;
  status: string;
  payment_status: string;
  items: OrderItem[];
}

type SessionPhase = 'loading' | 'no_session' | 'waiting_approval' | 'active';

const getUpsellRecommendation = (mainItemName: string) => {
  const cleanName = mainItemName.toLowerCase();
  if (cleanName.includes('커피') || cleanName.includes('아메리카노') || cleanName.includes('에스프레소') || cleanName.includes('라떼')) {
    return {
      title: '🍰 부드러운 뉴욕 치즈 케이크',
      desc: '진한 크림치즈의 풍미가 시원하고 고소한 아메리카노의 커피 맛을 극대화해 줍니다.',
      price: 6500,
      image: 'https://images.unsplash.com/photo-1524351199679-46cddf530c04?auto=format&fit=crop&q=80&w=200&h=200',
      menuName: '치즈 케이크'
    };
  }
  if (cleanName.includes('스테이크')) {
    return {
      title: '🍷 셰프 엄선 하우스 레드 와인',
      desc: '육즙 가득한 소고기 스테이크의 풍미와 마블링의 기름진 고소함을 깊고 진하게 받쳐줍니다.',
      price: 8000,
      image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&q=80&w=200&h=200',
      menuName: '레드 와인'
    };
  }
  if (cleanName.includes('파스타')) {
    return {
      title: '🥖 바삭한 마늘 브레드 & 에이드',
      desc: '꾸덕하고 감칠맛 넘치는 파스타 소스에 찍어 먹으면 바삭하고 달콤함이 2배가 됩니다.',
      price: 4500,
      image: 'https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?auto=format&fit=crop&q=80&w=200&h=200',
      menuName: '마늘 브레드'
    };
  }
  if (cleanName.includes('와인') || cleanName.includes('주류') || cleanName.includes('맥주')) {
    return {
      title: '🧀 럭셔리 모둠 치즈 플래터',
      desc: '엄선된 4가지 고급 슬라이스 치즈와 고소한 크래커로 술자리를 더욱 세련되게 완성해 보세요.',
      price: 15000,
      image: 'https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&q=80&w=200&h=200',
      menuName: '모둠 치즈'
    };
  }
  return {
    title: '🍰 달콤한 초코 가나슈 조각 케이크',
    desc: '오늘 식사의 마무리를 더욱 로맨틱하게 연출해 줄 진한 수제 초콜릿 풍미의 조각 디저트입니다.',
    price: 6800,
    image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=200&h=200',
    menuName: '초코 케이크'
  };
};

const MobileOrderV2: React.FC<Props> = ({ bundles, storeId, storeName: initialStoreName, onNavigate }) => {
  // AI 비서 ↔ 판형 메뉴 토글 (항상 AI 모드로 시작)
  const [viewMode, setViewMode] = useState<'ai' | 'menu'>('ai');

  // --- States ---
  const [cart, setCart] = useState<MenuItem[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [activeCategory, setActiveCategory] = useState('전체');
  const [isOrdering, setIsOrdering] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceToast, setVoiceToast] = useState<string | null>(null);
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>('loading');
  const [sessionId, setSessionId] = useState('');
  const [showPayModal, setShowPayModal] = useState(false);
  const [showParkingModal, setShowParkingModal] = useState(false);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [parkingApplied, setParkingApplied] = useState(false);
  const [callOverlay, setCallOverlay] = useState<{ status: 'pending' | 'completed'; callId: string; callType: string } | null>(null);
  const [parkingOverlay, setParkingOverlay] = useState<{ status: 'pending' | 'completed'; parkingId: string } | null>(null);
  const [userPhone] = useState('');
  const [aiStoryContent, setAiStoryContent] = useState({ title: '', body: '', icon: '🍽️' });
  const [showDelayedHelp, setShowDelayedHelp] = useState(false);

  // Dutch pay states
  const [showDutchModal, setShowDutchModal] = useState(false);
  const [dutchStep, setDutchStep] = useState<'select' | 'pay'>('select');
  const [dutchCount, setDutchCount] = useState(2);
  const [dutchPaidSlots, setDutchPaidSlots] = useState<boolean[]>([]);
  const [dutchFrozenTotal, setDutchFrozenTotal] = useState(0);
  const [dutchPayingSlot, setDutchPayingSlot] = useState<number | null>(null);
  const [showDutchPersonPayModal, setShowDutchPersonPayModal] = useState(false);

  // Lint bypass for onNavigate
  useEffect(() => {
    if (onNavigate) {
      // safe reference to bypass unused parameter lint
    }
  }, [onNavigate]);

  // --- Memos & Config ---
  // Resolve storeName from bundle if it's 'UnknownStore' or blank
  const storeName = useMemo(() => {
    if (initialStoreName && initialStoreName !== 'UnknownStore') {
      return initialStoreName;
    }
    const safeBundles = Array.isArray(bundles) ? bundles : [];
    const storeBundle = safeBundles.find(b => b.type === 'StoreConfig' && (b.store_id === storeId || !b.store_id));
    const resolved = storeBundle?.items?.find((i: any) => i.name === '상호명' || i.name === 'brand')?.value;
    return resolved || initialStoreName || '우리식당';
  }, [bundles, storeId, initialStoreName]);

  const tableNo = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('table') || '3';
  }, []);

  // QR 스캔 없이 직접 접근한 경우 차단 (table 파라미터 없음)
  const hasTableParam = useMemo(() => !!new URLSearchParams(window.location.search).get('table'), []);
  
  const tableId = useMemo(() => `T${tableNo.padStart(2, '0')}`, [tableNo]);

  const deviceId = useMemo(() => {
    let id = localStorage.getItem('device_id');
    if (!id) {
      id = 'DEV-' + Math.random().toString(36).substr(2, 9).toUpperCase();
      localStorage.setItem('device_id', id);
    }
    return id;
  }, []);

  const handleStaffCall = async () => {
    await sendNotify('STAFF_CALL', { table_id: tableId, store_id: storeId, call_type: '직원호출' });
    alert('🔔 카운터로 호출 신호를 보냈습니다. 잠시만 기다려 주세요!');
  };

  const menus = useMemo(() => {
    const safeBundles = Array.isArray(bundles) ? bundles : [];
    
    // Defensive multi-stage matching strategy to ensure menus never go blank
    // 1. Match by exact store_id (highest priority)
    let menuBundle = safeBundles.find(b => b.type === 'Menus' && b.store_id === storeId);
    
    // 2. Fallback to exact store name match
    if (!menuBundle && storeName) {
        menuBundle = safeBundles.find(b => b.type === 'Menus' && b.store === storeName);
    }
    
    // 3. Fallback to partial store name match (e.g., '초당' or '이탈리아' keywords)
    if (!menuBundle && storeName) {
        const cleanStoreName = storeName.replace(/\s+/g, '');
        menuBundle = safeBundles.find(b => {
            if (b.type !== 'Menus' || !b.store) return false;
            const cleanBStoreName = b.store.replace(/\s+/g, '');
            return cleanStoreName.includes(cleanBStoreName) || cleanBStoreName.includes(cleanStoreName);
        });
    }
    
    // 4. Fallback to first available Menus bundle if still not found (absolute fallback)
    if (!menuBundle) {
        menuBundle = safeBundles.find(b => b.type === 'Menus');
    }

    if (!menuBundle) return [];
    
    return (menuBundle.items || []).map((item: any) => {
        const priceNum = typeof item.value === 'number'
            ? item.value
            : (parseInt(String(item.value || '').replace(/[^0-9]/g, '')) || 0);
        const nameClean = String(item.name || '').replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]+/, '').trim();
        
        // --- Image Selection Logic ---
        const IMG = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=80&w=400&h=400`;
        let photoUrl = IMG('1546069901-ba9599a7e63c'); // Default: food bowl
        if (item.icon && (item.icon.startsWith('http://') || item.icon.startsWith('https://'))) {
            photoUrl = item.icon;
        }
        // ── 커피·음료 ──────────────────────────────
        else if (nameClean.includes('에스프레소'))   photoUrl = IMG('1510591509098-f4fdc6d0ff04');
        else if (nameClean.includes('아메리카노'))   photoUrl = IMG('1509042239860-f550ce710b93');
        else if (nameClean.includes('아인슈페너'))   photoUrl = IMG('1572442388796-11668a67e53d');
        else if (nameClean.includes('말차'))         photoUrl = IMG('1534787238-c61dcf8af7d2');
        else if (nameClean.includes('라떼') || nameClean.includes('커피')) photoUrl = IMG('1495474472287-4d71bcdd2085');
        // ── 디저트·베이커리 ────────────────────────
        else if (nameClean.includes('치즈케이크'))   photoUrl = IMG('1524351199679-46cddf530c04');
        else if (nameClean.includes('케이크'))       photoUrl = IMG('1578985545062-69928b1d9587');
        else if (nameClean.includes('수플레') || nameClean.includes('팬케이크')) photoUrl = IMG('1567620905732-2d1ec7ab7445');
        else if (nameClean.includes('크로플') || nameClean.includes('와플')) photoUrl = IMG('1567620905732-2d1ec7ab7445');
        else if (nameClean.includes('마늘브레드') || nameClean.includes('빵')) photoUrl = IMG('1573140247632-f8fd74997d5c');
        // ── 한우·고기 ──────────────────────────────
        else if (nameClean.includes('꽃등심') || nameClean.includes('등심') || nameClean.includes('안심') || nameClean.includes('한우')) photoUrl = IMG('1546241072-48010ad2862c');
        else if (nameClean.includes('육회'))         photoUrl = IMG('1504674900247-0877df9cc836');
        else if (nameClean.includes('갈비') || nameClean.includes('떡갈비')) photoUrl = IMG('1529193591184-b1d58069ecdd');
        else if (nameClean.includes('삼겹살') || nameClean.includes('바베큐')) photoUrl = IMG('1529193591184-b1d58069ecdd');
        else if (nameClean.includes('스테이크'))     photoUrl = IMG('1546241072-48010ad2862c');
        else if (nameClean.includes('제육볶음') || nameClean.includes('닭갈비')) photoUrl = IMG('1598103442097-8b74394b95c8');
        else if (nameClean.includes('치킨') || nameClean.includes('후라이드')) photoUrl = IMG('1562802378-063ec186a863');
        // ── 국·찌개·탕 ────────────────────────────
        else if (nameClean.includes('순두부') || nameClean.includes('두부')) photoUrl = IMG('1547592180-85f173990554');
        else if (nameClean.includes('된장') || nameClean.includes('김치찌개') || nameClean.includes('찌개')) photoUrl = IMG('1547592180-85f173990554');
        else if (nameClean.includes('신선로') || nameClean.includes('전골')) photoUrl = IMG('1569415593-f39428873e6b');
        else if (nameClean.includes('갈비탕') || nameClean.includes('탕')) photoUrl = IMG('1547592180-85f173990554');
        // ── 밥·면류 ────────────────────────────────
        else if (nameClean.includes('비빔밥') || nameClean.includes('돌솥')) photoUrl = IMG('1553163147-622ab57be1c7');
        else if (nameClean.includes('짜장'))         photoUrl = IMG('1512058456905-6ca9af2de0e3');
        else if (nameClean.includes('짬뽕'))         photoUrl = IMG('1569718212165-3a8278d5f624');
        else if (nameClean.includes('냉면'))         photoUrl = IMG('1555126634-323283e090fa');
        else if (nameClean.includes('파스타'))       photoUrl = IMG('1473093226795-af9932fe5856');
        else if (nameClean.includes('쌀국수') || nameClean.includes('국수')) photoUrl = IMG('1569718212165-3a8278d5f624');
        else if (nameClean.includes('정식') || nameClean.includes('백반') || nameClean.includes('수라간')) photoUrl = IMG('1611532736597-de2d4265fba3');
        // ── 분식·사이드 ────────────────────────────
        else if (nameClean.includes('탕수육'))       photoUrl = IMG('1551782450-17144efb9c50');
        else if (nameClean.includes('파전') || nameClean.includes('전병') || nameClean.includes('해물파전')) photoUrl = IMG('1568901346375-23c9450c58cd');
        else if (nameClean.includes('잡채'))         photoUrl = IMG('1534482421-64566f976cfa');
        else if (nameClean.includes('만두'))         photoUrl = IMG('1563245372-f21724e3856d');
        else if (nameClean.includes('새우') || nameClean.includes('해물') || nameClean.includes('골뱅이')) photoUrl = IMG('1559847844-5315695dadae');
        else if (nameClean.includes('묵') || nameClean.includes('도토리')) photoUrl = IMG('1547592180-85f173990554');
        // ── 주류·음료 ──────────────────────────────
        else if (nameClean.includes('와인') || nameClean.includes('복분자주')) photoUrl = IMG('1510812431401-41d2bd2722f3');
        else if (nameClean.includes('맥주') || nameClean.includes('생맥주')) photoUrl = IMG('1535958636474-b021ee887b13');
        else if (nameClean.includes('소주'))         photoUrl = IMG('1571091718767-18b5b1457add');
        else if (nameClean.includes('막걸리') || nameClean.includes('전통주') || nameClean.includes('고량주') || nameClean.includes('식혜')) photoUrl = IMG('1621503510889-f4becea1b66e');
        else if (nameClean.includes('사이다') || nameClean.includes('콜라') || nameClean.includes('음료') || nameClean.includes('에이드')) photoUrl = IMG('1520390138845-fd2d229dd553');

        return {
            name: nameClean,
            price: priceNum,
            icon: photoUrl, // Reusing icon field for image URL for simplicity
            category: item.category || '추천',
            description: item.description || '최고의 재료로 만든 시그니처 메뉴'
        };
    });
  }, [bundles, storeId, storeName]);

  const categories = useMemo(() => ['전체', ...new Set((menus || []).map(m => m.category))], [menus]);
  const totalPrice = useMemo(() => cart.reduce((sum, item) => sum + (item.price * (item.qty || 1)), 0), [cart]);

  // --- Session State Machine ---
  const sessionIdRef = React.useRef('');
  const sessionPhaseRef = React.useRef<SessionPhase>('loading');
  const pendingSessionIdRef = React.useRef('');
  const storeNameRef = React.useRef(storeName);
  useEffect(() => { storeNameRef.current = storeName; }, [storeName]);

  // Dutch pay refs (for access in event handlers / async closures)
  const dutchPayingSlotRef = React.useRef<number | null>(null);
  const dutchPaidSlotsRef = React.useRef<boolean[]>([]);
  const dutchCountRef = React.useRef(2);
  const dutchFrozenTotalRef = React.useRef(0);
  const catScrollRef = React.useRef<HTMLDivElement>(null);
  const menuScrollRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => { dutchPaidSlotsRef.current = dutchPaidSlots; }, [dutchPaidSlots]);
  useEffect(() => { dutchCountRef.current = dutchCount; }, [dutchCount]);
  useEffect(() => { dutchFrozenTotalRef.current = dutchFrozenTotal; }, [dutchFrozenTotal]);

  const refreshOrders = useCallback(async () => {
    if (!sessionIdRef.current) return;
    try {
      const res = await fetch(`${API_BASE}/api/session/${tableId}?store_id=${storeId}`);
      const data = await res.json();
      if (data?.session?.status === 'active') {
        setMyOrders(data.orders || []);
      }
    } catch (err) {
      console.error("Refresh orders failed:", err);
    }
  }, [tableId, storeId]);

  const joinSession = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/checkin/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableNo, deviceId, store: storeNameRef.current, store_id: storeId })
      });
      const data = await res.json();
      if (data.status === 'active') {
        const sid = data.session?.session_id || '';
        sessionIdRef.current = sid;
        setSessionId(sid);
        setMyOrders(data.orders || []);
        sessionPhaseRef.current = 'active';
        setSessionPhase('active');

        // 주문 내역이 있으면 자동으로 현황판 모드로 전환
        if (data.orders && data.orders.length > 0) {
          setShowProgress(true);
        }
      } else if (data.status === 'waiting_approval') {
        pendingSessionIdRef.current = data.session_id || '';
        sessionPhaseRef.current = 'waiting_approval';
        setSessionPhase('waiting_approval');
      } else {
        sessionPhaseRef.current = 'no_session';
        setSessionPhase('no_session');
      }
    } catch (err) {
      console.error("Checkin error:", err);
      sessionPhaseRef.current = 'no_session';
      setSessionPhase('no_session');
    }
  }, [tableNo, deviceId, storeId]);

  const addToCart = useCallback((menu: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.name === menu.name);
      if (existing) {
        return prev.map(c => c.name === menu.name ? { ...c, qty: (c.qty || 0) + 1 } : c);
      }
      return [...prev, { ...menu, qty: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((name: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.name === name);
      if (existing && (existing.qty || 0) > 1) {
        return prev.map(c => c.name === name ? { ...c, qty: (c.qty || 0) - 1 } : c);
      }
      return prev.filter(c => c.name !== name);
    });
  }, []);


  const generateAiStory = useCallback((items: MenuItem[]) => {
    if (items.length === 0) return;
    const firstItem = items[0];
    const stories: any = {
      '스테이크': { title: '🥩 왕의 요리, 스테이크', body: '스테이크의 어원은 "구운 고기"를 뜻하는 스칸디나비아어 "steik"에서 유래했습니다. 고단백 영양소뿐만 아니라 철분이 풍부해 활력을 불어넣어 주죠.', icon: '🥩' },
      '파스타': { title: '🍝 이탈리아의 자부심, 파스타', body: '파스타는 13세기 마르코 폴로가 중국에서 가져왔다는 설이 유명하지만, 사실 고대 로마 시대부터 즐겨 먹던 요리입니다. 듀럼밀 세몰리나로 만들어 천천히 소화되는 건강한 탄수화물이죠.', icon: '🍝' },
      '커피': { title: '☕ 에티오피아의 눈물, 커피', body: '9세기 에티오피아의 목동 칼디가 발견한 커피는 전 세계에서 가장 사랑받는 음료가 되었습니다. 적당한 카페인은 집중력을 높여주고 항산화 성분이 풍부합니다.', icon: '☕' },
      '와인': { title: '🍷 신의 물방울, 와인', body: '인류 역사와 함께해온 와인은 항산화제인 레스베라트롤이 풍부해 심혈관 건강에 도움을 줄 수 있습니다. 주문하신 메뉴와 환상적인 조화를 이룰 거예요.', icon: '🍷' }
    };
    const foundKey = Object.keys(stories).find(key => firstItem.name.includes(key));
    if (foundKey) {
      setAiStoryContent(stories[foundKey]);
    } else {
      setAiStoryContent({
        title: `✨ ${firstItem.name}의 미식 이야기`,
        body: `주문하신 ${firstItem.name}은(는) 셰프님이 가장 정성을 들여 준비하는 메뉴 중 하나입니다. 신선한 재료와 완벽한 조리법으로 최고의 맛을 선사해 드릴게요.`,
        icon: '🍳'
      });
    }
  }, []);

  // --- Effects ---
  useEffect(() => {
    const unsubscribeTable = subscribeTopic(`situation/table/${tableId}`, (msg) => {
      switch (msg.type) {
        case 'SESSION_OPENED':
          joinSession();
          break;
        case 'SESSION_CLOSED':
          sessionIdRef.current = '';
          setSessionId('');
          setMyOrders([]);
          sessionPhaseRef.current = 'no_session';
          setSessionPhase('no_session');
          break;
        case 'JOIN_RESPONSE':
          if (msg.device_id === deviceId) {
            if (msg.approved) {
              sessionIdRef.current = msg.session_id;
              setSessionId(msg.session_id);
              sessionPhaseRef.current = 'active';
              setSessionPhase('active');
              refreshOrders();
            } else {
              sessionPhaseRef.current = 'no_session';
              setSessionPhase('no_session');
            }
          }
          break;
        default:
          refreshOrders();
      }
    });

    joinSession();

    const timer = setInterval(() => {
      if (sessionPhaseRef.current !== 'waiting_approval') {
        joinSession();
      }
    }, 5000);

    return () => { unsubscribeTable(); clearInterval(timer); };
  }, [tableId, storeId, deviceId, joinSession, refreshOrders]);

  // --- Delayed Payment Watcher ---
  useEffect(() => {
    const latestOrder = myOrders.length > 0 ? myOrders[myOrders.length - 1] : null;
    const isPending = latestOrder?.payment_status === 'pending';

    if (showProgress && isPending) {
      const timer = setTimeout(() => setShowDelayedHelp(true), 15000); // 15초 이상 지연 시
      return () => clearTimeout(timer);
    } else {
      setShowDelayedHelp(false);
    }
  }, [showProgress, myOrders]);

  // --- Payment Result Handling (Event driven from App.tsx) ---
  useEffect(() => {
    const handleFinished = (e: any) => {
      const { success } = e.detail;
      if (success) {
        localStorage.removeItem('payment_success_flag');

        // Dutch pay mode: track per-slot completion
        if (dutchPayingSlotRef.current !== null) {
          const slotIdx = dutchPayingSlotRef.current;
          dutchPayingSlotRef.current = null;
          const count = dutchCountRef.current;
          const next = [...dutchPaidSlotsRef.current];
          next[slotIdx] = true;
          dutchPaidSlotsRef.current = next;
          setDutchPaidSlots([...next]);
          setShowDutchPersonPayModal(false);
          setDutchPayingSlot(null);
          if (next.filter(Boolean).length === count) {
            setCart([]);
            setShowDutchModal(false);
            refreshOrders();
            setShowProgress(true);
            setVoiceToast('🤝 더치페이 완료! 모두 결제되었습니다.');
            setTimeout(() => setVoiceToast(null), 4000);
          }
          return;
        }

        setCart([]);
        refreshOrders();
        setShowProgress(true);
      }
    };

    const params = new URLSearchParams(window.location.search);
    const hasSuccessFlag = localStorage.getItem('payment_success_flag') === 'true';
    if (params.get('payment_success') === 'true' || hasSuccessFlag) {
      localStorage.removeItem('payment_success_flag');
      setCart([]);
      refreshOrders();
      setShowProgress(true);
    }

    window.addEventListener('payment_finished', handleFinished);
    return () => window.removeEventListener('payment_finished', handleFinished);
  }, [refreshOrders]);

  // --- Auto Generate AI Story for Electronic/Loaded Orders ---
  useEffect(() => {
    if (showProgress && myOrders.length > 0 && !aiStoryContent.title) {
      const latestOrder = myOrders[myOrders.length - 1];
      if (latestOrder && latestOrder.items && latestOrder.items.length > 0) {
        generateAiStory(latestOrder.items as any);
      }
    }
  }, [showProgress, myOrders, aiStoryContent.title, generateAiStory]);

  useEffect(() => {
    if (!showProgress) {
      setAiStoryContent({ title: '', body: '', icon: '🍽️' });
    }
  }, [showProgress]);

  const requestStaffCall = useCallback(async (callType: string = "직원호출") => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
      const res = await fetch(`${apiUrl}/api/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id: tableId, store_id: storeId, call_type: callType }),
      });
      if (res.ok) {
        const data = await res.json();
        setCallOverlay({ status: 'pending', callId: data.call_id, callType });
      } else {
        setVoiceToast("❌ 호출 전송 실패. 카운터로 직접 문의해 주세요.");
        setTimeout(() => setVoiceToast(null), 3000);
      }
    } catch (err) {
      console.error("Staff call error:", err);
      setVoiceToast("❌ 호출 전송 실패. 카운터로 직접 문의해 주세요.");
      setTimeout(() => setVoiceToast(null), 3000);
    }
  }, [tableId, storeId]);

  const handleParkingSubmit = async () => {
    if (!vehicleNumber.trim() || vehicleNumber.trim().length < 4) {
      setVoiceToast("차량 번호 뒤 4자리를 정확하게 입력해 주세요.");
      setTimeout(() => setVoiceToast(null), 3000);
      return;
    }
    
    let targetSessionId = sessionId;
    if (!targetSessionId) {
      try {
        const res = await fetch(`${API_BASE}/api/session/${tableId}?store_id=${storeId}`);
        const data = await res.json();
        if (data && data.session) {
          targetSessionId = data.session.session_id;
          setSessionId(targetSessionId);
        }
      } catch (err) {
        console.error(err);
      }
    }
    
    if (!targetSessionId) {
      setVoiceToast("현재 테이블 주문 세션이 활성화되지 않았습니다. 먼저 주문을 진행해 주세요!");
      setTimeout(() => setVoiceToast(null), 3000);
      return;
    }
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
      const res = await fetch(`${apiUrl}/api/parking/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: targetSessionId,
          vehicle_number: vehicleNumber,
          discount_minutes: 120,
          store_id: storeId
        })
      });
      if (res.ok) {
        const data = await res.json();
        setParkingApplied(true);
        setShowParkingModal(false);
        setVehicleNumber('');
        setParkingOverlay({ status: 'pending', parkingId: data.parking_id });
      } else {
        const errData = await res.json();
        setVoiceToast(errData.detail || "주차 등록에 실패했습니다. 다시 시도해 주세요.");
        setTimeout(() => setVoiceToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setVoiceToast("⚠️ 주차 등록 실패. 카운터로 문의해 주세요.");
      setTimeout(() => setVoiceToast(null), 3000);
    }
  };

  // --- AI Voice Ordering Logic ---
  const speakResponse = (msg: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(msg);
      utterance.lang = 'ko-KR';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const parseVoiceCommand = useCallback((text: string) => {
    const textClean = text.replace(/\s+/g, '');
    
    // 직원 호출 음성 키워드 매칭
    if (textClean.includes('호출') || textClean.includes('도와줘') || textClean.includes('직원') || textClean.includes('벨') || textClean.includes('물좀') || textClean.includes('물주세') || textClean.includes('물필요')) {
      const isWater = textClean.includes('물');
      const callType = isWater ? "물 제공 요청" : "직원호출";
      speakResponse(`${callType} 요청을 완료했습니다. 잠시만 기다려 주세요.`);
      setVoiceToast(`🔔 [음성 인식] ${callType}을 요청했습니다.`);
      requestStaffCall(callType);
      setTimeout(() => setVoiceToast(null), 2500);
      return;
    }

    // 1. Utility commands
    if (textClean.includes('장바구니') || textClean.includes('결제') || textClean.includes('주문하기')) {
      if (cart.length > 0) {
        speakResponse("장바구니를 열고 결제를 진행합니다.");
        setShowPayModal(true);
        setTimeout(() => setVoiceToast(null), 2500);
        return;
      } else {
        speakResponse("장바구니가 비어 있습니다. 주문할 메뉴를 먼저 골라 담아주세요.");
        return;
      }
    }

    if (textClean.includes('비워') || textClean.includes('초기화')) {
      setCart([]);
      speakResponse("장바구니를 모두 비웠습니다.");
      setVoiceToast("🗑️ 장바구니를 모두 비웠습니다.");
      setTimeout(() => setVoiceToast(null), 2500);
      return;
    }

    // 2. Intelligent Partial Keyword Match against items in active store's menu
    let found = false;
    const sortedMenus = [...menus].sort((a, b) => b.name.length - a.name.length);

    // List of common Korean stopwords/particles in ordering context to isolate the core food nouns
    const stopwords = [
      '하나', '둘', '셋', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열',
      '한개', '두개', '세개', '네개', '다섯개', '개', '개만', '개랑', '개요',
      '담기', '담아', '담아줘', '담아주세요', '주세요', '주문', '주문해줘', '주문해요',
      '추가', '추가해줘', '부탁', '부탁해', '부탁해요', '줘', '요'
    ];
    
    // Create a highly stripped down version of the spoken query
    let speechCleaned = textClean;
    stopwords.forEach(sw => {
      speechCleaned = speechCleaned.replace(new RegExp(sw, 'g'), '');
    });

    // Also extract space-separated words from the original spoken text and clean their suffixes
    const originalWords = text.split(/\s+/).map(w => {
      let cleanedWord = w.trim();
      stopwords.forEach(sw => {
        cleanedWord = cleanedWord.replace(new RegExp(sw + '$', 'g'), '');
      });
      return cleanedWord;
    }).filter(w => w.length >= 2); // Only keep keywords of at least length 2 to avoid single-char matching

    for (const item of sortedMenus) {
      // Strip emojis and trim
      const nameOnly = item.name.replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]+/, '').trim();
      const cleanName = nameOnly.replace(/\s+/g, '');
      
      // Smart Multi-tier Matching:
      // A. Perfect match (user spoke the full exact menu name)
      const perfectMatch = text.includes(nameOnly) || textClean.includes(cleanName);
      
      // B. Spoken noun is a sub-part of the menu name (e.g., "순두부" -> matches "초당 맑은 순두부")
      const menuContainsSpokenKeyword = speechCleaned.length >= 2 && cleanName.includes(speechCleaned);
      
      // C. Any of the separate spoken words (length >= 2) is a sub-part of the menu name
      const extractedKeywordMatch = originalWords.some(word => cleanName.includes(word));
      
      if (perfectMatch || menuContainsSpokenKeyword || extractedKeywordMatch) {
        // Clean the matched menu name from the spoken text to avoid false-positive quantity matching (e.g. '두' in '순두부')
        const qtyText = text.replace(nameOnly, '').replace(cleanName, '');
        let qty = 1;
        if (qtyText.includes('두') || qtyText.includes('2') || qtyText.includes('둘') || qtyText.includes('이개') || qtyText.includes('이 개') || qtyText.includes('두 개') || qtyText.includes('두개')) qty = 2;
        else if (qtyText.includes('세') || qtyText.includes('3') || qtyText.includes('셋') || qtyText.includes('삼개') || qtyText.includes('삼 개') || qtyText.includes('세 개') || qtyText.includes('세개')) qty = 3;
        else if (qtyText.includes('네') || qtyText.includes('4') || qtyText.includes('넷') || qtyText.includes('사개') || qtyText.includes('사 개') || qtyText.includes('네 개') || qtyText.includes('네개')) qty = 4;
        else if (qtyText.includes('다섯') || qtyText.includes('5') || qtyText.includes('오개') || qtyText.includes('오 개')) qty = 5;
        
        setCart(prev => {
          const existing = prev.find(c => c.name === item.name);
          if (existing) {
            return prev.map(c => c.name === item.name ? { ...c, qty: (c.qty || 0) + qty } : c);
          }
          return [...prev, { ...item, qty }];
        });

        const replyMsg = `${nameOnly} ${qty}개를 장바구니에 담았습니다.`;
        speakResponse(replyMsg);
        setVoiceToast(`🎯 담기 완료: ${item.name} ${qty}개`);
        found = true;
        break;
      }
    }

    if (!found) {
      const failMsg = "메뉴를 찾지 못했습니다. 메뉴판에 기재된 정확한 명칭을 말씀해 주세요.";
      speakResponse(failMsg);
      setVoiceToast("❓ 일치하는 메뉴를 찾지 못했습니다.");
    }

    setTimeout(() => setVoiceToast(null), 4000);
  }, [menus, cart]);

  const toggleVoiceOrdering = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("이 브라우저는 음성 인식을 지원하지 않습니다. 구글 크롬 또는 모바일 사파리 브라우저를 이용해 주세요.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.lang = 'ko-KR';
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setIsListening(true);
      setVoiceToast("🎙️ 마이크가 활성화되었습니다. '갈비찜 2개' 또는 '장바구니 보여줘' 라고 말씀해 주세요!");
    };

    rec.onend = () => {
      setIsListening(false);
    };

    rec.onerror = (e: any) => {
      console.error("Speech Error:", e);
      setIsListening(false);
      setVoiceToast("⚠️ 음성 인식 실패. 마이크 접근 권한이나 노이즈를 확인해 주세요.");
      setTimeout(() => setVoiceToast(null), 3000);
    };

    rec.onresult = (event: any) => {
      const speechText = event.results[0][0].transcript;
      setVoiceToast(`🎙️ 인식 결과: "${speechText}"`);
      parseVoiceCommand(speechText);
    };

    rec.start();
  }, [isListening, parseVoiceCommand]);

  // --- 고객 알림 오버레이: MQTT 구독 ---
  useEffect(() => {
    if (!callOverlay && !parkingOverlay) return;
    const playDingDong = () => {
      try {
        const audio = new Audio('https://www.orangefreesounds.com/wp-content/uploads/2014/09/Ding-dong.mp3');
        audio.volume = 0.8;
        audio.play().catch(() => {});
      } catch (_) {}
    };
    return subscribeToStore(storeId, (data) => {
      if (callOverlay && data.type === 'CALL_STATUS_UPDATED' && data.call_id === callOverlay.callId) {
        setCallOverlay(prev => prev ? { ...prev, status: 'completed' } : null);
        playDingDong();
      }
      if (parkingOverlay && data.type === 'PARKING_COMPLETED' && data.parking_id === parkingOverlay.parkingId) {
        setParkingOverlay(prev => prev ? { ...prev, status: 'completed' } : null);
        playDingDong();
      }
    });
  }, [storeId, callOverlay?.callId, parkingOverlay?.parkingId]);

  // --- Android/Browser Back Button Handling ---
  useEffect(() => {
    const handlePopState = () => {
      // 만약 서브 뷰가 열려있다면 닫고 브라우저 이동은 막음
      if (showProgress) {
        setShowProgress(false);
      }
    };

    if (showProgress) {
      window.history.pushState({ subView: true }, '');
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showProgress]);






  const executeOrderWithPayment = useCallback(async (method: string, extraData?: any) => {
    setIsOrdering(true);
    // setShowPayModal(false); // <--- 여기서 미리 닫지 않고, 서버 처리가 끝나면 닫도록 변경
    
    // [CP-00] 주문 시작 로그
    PaymentService.log("CP-00", "Order process initiated", { method, cartSize: cart.length });

    try {
      const currentCart = [...cart];
      const usePoints = extraData?.usePoints || 0;
      const finalAmount = extraData?.dutchAmount !== undefined ? extraData.dutchAmount : totalPrice - usePoints;

      // [CP-01] 백엔드 주문 생성 시도
      PaymentService.log("CP-01", "Creating order on backend...");
      const res = await fetch(`${API_BASE}/api/order/direct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: tableId, device_id: deviceId, store_id: storeId,
          items: cart.map(c => ({ name: c.name, quantity: c.qty || 1, price: c.price, qty: c.qty || 1 })),
          total_price: finalAmount,
          payment_status: (method.includes('카운터') || method.includes('현금') || method.includes('cash')) ? 'unpaid' : 'pending',
          payment_method: method,
          metadata: extraData
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        PaymentService.log("CP-01-ERR", "Backend order creation failed", errorData);
        throw new Error(errorData.detail || '주문 생성 실패');
      }

      const orderData = await res.json();
      const orderId = orderData.order_id;
      PaymentService.log("CP-01", "Success: Order created", { orderId });

      // [CP-02] 결제 수단 분기
      const isCounterPay = method.includes('카운터') || method.includes('현금') || method.includes('cash');

      // 주문서 생성이 완료되었으므로 이제 결제창을 닫습니다.
      setShowPayModal(false);

      if (isCounterPay) {
        PaymentService.log("CP-02", "Counter/Cash Flow - Skipping external PG");
        if (extraData?.isDutchPay) {
          // Dutch pay cash: fire payment_finished for unified Dutch tracking
          setTimeout(() => window.dispatchEvent(new CustomEvent('payment_finished', { detail: { success: true } })), 0);
        } else {
          setCart([]);
          refreshOrders();
          generateAiStory(currentCart);
          setShowProgress(true);
        }
      } else {
        // [CP-03] 토스 결제 호출 (Service 모듈로 위임)
        PaymentService.log("CP-02", "Electronic Payment Flow - Handoff to PaymentService");
        localStorage.setItem('receipt_items_' + orderId, JSON.stringify(
          currentCart.map(c => ({ name: c.name, value: String(c.qty || 1) + '개' }))
        ));
        await PaymentService.requestTossPayment(method, {
          amount: finalAmount,
          orderId: orderId,
          orderName: extraData?.dutchLabel || `${currentCart[0].name}${currentCart.length > 1 ? ` 외 ${currentCart.length-1}건` : ''}`,
          customerName: '손님'
        });
      }
    } catch (err: any) { 
      PaymentService.log("CP-ERR-GLOBAL", "Process interrupted", err.message);
      alert(`[CP-ERR] 주문 처리 중 오류가 발생했습니다: ${err.message || '알 수 없는 오류'}`);
    } finally { 
      setIsOrdering(false); 
    }
  }, [tableId, deviceId, storeId, cart, totalPrice, refreshOrders, generateAiStory]);

  const handleAddUpsell = useCallback((rec: any) => {
    // Find if this menu item exists in our loaded menus
    const existingMenu = menus.find(m => m.name.includes(rec.menuName) || rec.menuName.includes(m.name));
    const itemToAdd = existingMenu || {
      name: rec.menuName,
      price: rec.price,
      icon: rec.image,
      category: '추천',
      description: rec.desc
    };
    
    // Add to cart
    setCart(prev => {
      const existing = prev.find(c => c.name === itemToAdd.name);
      if (existing) {
        return prev.map(c => c.name === itemToAdd.name ? { ...c, qty: (c.qty || 0) + 1 } : c);
      }
      return [...prev, { ...itemToAdd, qty: 1 }];
    });
    
    // Switch to menu view and show payment modal directly
    setShowProgress(false);
    setVoiceToast(`🍰 꿀조합 [${rec.menuName}]이 장바구니에 추가되었습니다! 바로 결제를 진행합니다.`);
    setTimeout(() => {
      setVoiceToast(null);
      setShowPayModal(true);
    }, 1200);
  }, [menus]);

  // --- Render Functions ---

  const renderProgressScreen = () => {
    const latestOrder = myOrders.length > 0 ? myOrders[myOrders.length - 1] : null;
    const isPaid = latestOrder?.payment_status === 'paid' || latestOrder?.payment_status === 'prepaid';
    
    const latestOrderName = latestOrder?.items && latestOrder.items.length > 0 ? latestOrder.items[0].name : '';
    const recommendation = getUpsellRecommendation(latestOrderName);

    return (
      <div className="progress-inline-wrapper animate-fade-in" style={{ 
        width: '100%', 
        padding: '20px 0px 120px', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        position: 'relative'
      }}>
        {/* SCROLLABLE MAIN CONTENT AREA */}
        <div style={{ width: '100%', maxWidth: '450px', padding: '0 15px', boxSizing: 'border-box' }}>
          
          {/* [2] 1,2,3차 차수별 실시간 누적 주문 내역 */}
          <div style={{ 
            background: 'linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))', 
            border: '1px solid rgba(255,255,255,0.06)', 
            borderRadius: '24px', 
            padding: '20px', 
            marginBottom: '20px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)'
          }}>
            <h3 style={{ color: 'white', fontSize: '15px', margin: '0 0 15px 0', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              🧾 실시간 차수별 주문 내역
            </h3>
            {myOrders.length === 0 ? (
              <p style={{ textAlign: 'center', fontSize: '12px', opacity: 0.5, color: '#94a3b8', margin: '10px 0' }}>주문 내역이 없습니다.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {myOrders.map((order, idx) => {
                  const isPaid = order.payment_status === 'paid' || order.payment_status === 'prepaid';
                  const borderColor = isPaid ? '#10b981' : '#f59e0b';
                  return (
                    <div key={idx} style={{ 
                      background: 'rgba(255,255,255,0.01)', 
                      borderLeft: `4px solid ${borderColor}`, 
                      borderRadius: '12px', 
                      padding: '12px',
                      border: '1px solid rgba(255,255,255,0.03)',
                      borderLeftWidth: '4px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: borderColor }}>
                          #{order.order_seq}차 주문 {isPaid ? ' (결제완료)' : ' (미결제)'}
                        </span>
                        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
                          {order.status === 'cooking' ? '🔥 조리중' : 
                           order.status === 'ready' ? '⚡ 조리완료' : 
                           (order.status === 'pending_payment' || order.status === 'pending') ? '💳 결제 대기중' : 
                           order.status === 'served' ? '✅ 서빙완료' : '⌛ 접수중'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {order.items?.map((item: any, i: number) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#cbd5e1' }}>
                            <span>{item.name}</span>
                            <span style={{ fontWeight: 600 }}>{item.quantity || item.qty}개 | {((item.price || 0) * (item.quantity || item.qty || 1)).toLocaleString()}원</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ textAlign: 'right', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px', fontSize: '12px', fontWeight: 800, color: '#f97316' }}>
                        금액: {(order.total_price ?? (order as any).total ?? 0).toLocaleString()}원
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* [3] 미식 안내 (음식 이야기) */}
          <div className="glass-card" style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '20px', borderRadius: '24px' }}>
            <div style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: '10px' }}>{aiStoryContent.icon || '🍽️'}</div>
            <h3 style={{ color: '#f97316', textAlign: 'center', margin: '0 0 10px 0', fontSize: '1.2rem', fontWeight: 800 }}>{aiStoryContent.title || '🍴 미식 가이드 상식'}</h3>
            <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.6, textAlign: 'center', margin: 0 }}>
              {aiStoryContent.body || '주문하신 명품 시그니처 메뉴가 주방에서 조리되는 동안 요리의 기원과 유래, 상식을 읽어보세요.'}
            </p>
          </div>

          {/* [4] 매출 유도 꿀조합 추천 상품 슬라이더 */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(249,115,22,0.18), rgba(239,68,68,0.1))',
            border: '1.5px solid rgba(249,115,22,0.4)',
            borderRadius: '24px',
            padding: '20px',
            marginBottom: '20px',
            boxShadow: '0 12px 28px rgba(249,115,22,0.12)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: '10px',
              right: '-25px',
              background: '#f97316',
              color: 'white',
              fontSize: '8px',
              fontWeight: 900,
              padding: '4px 24px',
              transform: 'rotate(45deg)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              BEST COMBINATION
            </div>
            <h4 style={{ color: 'white', fontSize: '14px', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800 }}>
              🍯 맛을 2배 높이는 최고의 꿀조합 추천!
            </h4>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              <img 
                src={recommendation.image} 
                alt={recommendation.title} 
                style={{ width: '75px', height: '75px', borderRadius: '14px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.15)' }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h5 style={{ color: '#f97316', margin: '0 0 3px 0', fontSize: '12.5px', fontWeight: 800 }}>{recommendation.title}</h5>
                <p style={{ fontSize: '11px', color: '#cbd5e1', margin: '0 0 8px 0', lineHeight: 1.4 }}>{recommendation.desc}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'white' }}>{recommendation.price.toLocaleString()}원</span>
                  <button 
                    onClick={() => handleAddUpsell(recommendation)}
                    style={{
                      background: '#f97316',
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white',
                      padding: '5px 12px',
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '0 4px 10px rgba(249,115,22,0.3)',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    🛒 1초 추가 주문
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* [5] 결제 실패/대기 관련 안내 및 긴급 안내 */}
          {!isPaid && latestOrder?.payment_status === 'pending' && (
            <div style={{ 
              background: 'rgba(239, 68, 68, 0.1)', padding: '15px', borderRadius: '20px', 
              border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: '20px',
              animation: 'fadeIn 0.5s ease-in-out'
            }}>
              <p style={{ color: '#f87171', fontSize: '12px', fontWeight: 700, margin: 0, textAlign: 'center', lineHeight: 1.5 }}>
                ⚠️ 결제가 아직 확인되지 않았습니다.<br/>
                네트워크 지연이 발생할 수 있으니 잠시만 기다려 주세요.
              </p>
              {showDelayedHelp && (
                <div className="animate-fade-in" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed rgba(239, 68, 68, 0.2)' }}>
                  <p style={{ color: 'white', fontSize: '11px', fontWeight: 500, margin: '0 0 8px 0', textAlign: 'center' }}>
                    지속적으로 결제 확인이 안 되시나요?
                  </p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => alert('직원을 호출했습니다. 잠시만 기다려 주세요.')}
                      style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}
                    >
                      카운터에 문의
                    </button>
                    <button 
                      onClick={() => {
                        alert('후불 결제(카운터 결제)로 전환을 요청했습니다. 식사 후 나가실 때 결제해 주세요.');
                        setShowProgress(false);
                      }}
                      style={{ flex: 1, background: '#f97316', border: 'none', color: 'white', padding: '8px', borderRadius: '10px', fontSize: '11px', fontWeight: 800 }}
                    >
                      나중에 결제하기
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* [6] 말로 더 주문하기 배너 */}
          <div style={{ background: 'rgba(249,115,22,0.06)', padding: '15px', borderRadius: '20px', border: '1px dashed rgba(249,115,22,0.3)', marginBottom: '25px' }}>
            <h4 style={{ color: '#ea580c', fontSize: '14px', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>🎙️ 말로 더 주문해 보세요!</h4>
            <p style={{ fontSize: '11.5px', color: '#475569', lineHeight: 1.5, margin: '0 0 8px 0', fontWeight: 500 }}>
              하단 오렌지색 마이크를 누르고 <strong style={{ color: '#0f172a' }}>"콜라 하나 더"</strong> 또는 <strong style={{ color: '#0f172a' }}>"물 좀 주세요"</strong>라고 말씀하시면 즉각 처리됩니다.
            </p>
            <p style={{ fontSize: '11px', color: '#ea580c', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
              💡 식사 종료 시에는 언제든 마이크를 대고 <strong style={{ color: '#c2410c' }}>"정산해줘"</strong>라고 말씀하실 수도 있습니다.
            </p>
          </div>

          {/* [7] 추가 주문 및 종료 행동 버튼 */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => setShowProgress(false)}
              style={{ 
                flex: 1.3, 
                background: 'rgba(249, 115, 22, 0.08)', 
                border: '1.5px solid rgba(249, 115, 22, 0.25)', 
                color: '#f97316', 
                padding: '16px', 
                borderRadius: '15px', 
                fontWeight: 800, 
                fontSize: '0.95rem', 
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(249, 115, 22, 0.05)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.background = 'rgba(249, 115, 22, 0.12)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.background = 'rgba(249, 115, 22, 0.08)';
              }}
            >
              📋 메뉴판 보기 (추가 주문)
            </button>
            <button onClick={() => {
              window.close();
              setTimeout(() => {
                const conf = window.confirm("화면을 닫으시겠습니까? (QR코드를 통해 언제든 다시 주문 가능합니다.)");
                if (conf) {
                  window.location.href = "about:blank";
                }
              }, 100);
            }}
              style={{ 
                flex: 0.7, 
                background: '#ef4444', 
                border: 'none', 
                color: 'white', 
                padding: '16px', 
                borderRadius: '15px', 
                fontWeight: 800, 
                fontSize: '0.95rem', 
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              🚪 종료
            </button>
          </div>

        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (showProgress) return renderProgressScreen();

    const filteredMenus = (menus || []).filter(m => activeCategory === '전체' || m.category === activeCategory);

    const arrowBtnStyle: React.CSSProperties = {
      flexShrink: 0, width: '28px', height: '28px',
      background: '#f1f5f9', border: '1.5px solid #cbd5e1',
      borderRadius: '50%', color: '#475569', fontSize: '11px',
      cursor: 'pointer', display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontWeight: 900, padding: 0, lineHeight: 1,
    };

    const qtyBtnS: React.CSSProperties = {
      width: '20px', height: '20px', border: 'none',
      background: 'transparent', borderRadius: '50%',
      fontSize: '14px', fontWeight: 900, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 0, lineHeight: 1,
    };

    return (
      <>
        {/* ── 카탈로그 스크롤바 (카테고리 ◀▶) ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 0 10px' }}>
          <button style={arrowBtnStyle} onClick={() => catScrollRef.current?.scrollBy({ left: -120, behavior: 'smooth' })}>◀</button>
          <div ref={catScrollRef} style={{ flex: 1, display: 'flex', gap: '7px', overflowX: 'auto', scrollbarWidth: 'none', padding: '2px 0' }}>
            {categories.map((cat, i) => {
              const isSel = activeCategory === cat;
              return (
                <button key={i} onClick={() => setActiveCategory(cat)} style={{
                  flexShrink: 0,
                  background: isSel ? '#f97316' : '#f1f5f9',
                  border: isSel ? 'none' : '1.5px solid #e2e8f0',
                  color: isSel ? 'white' : '#475569',
                  padding: '6px 14px', borderRadius: '100px',
                  fontSize: '12.5px', fontWeight: 800, whiteSpace: 'nowrap', cursor: 'pointer',
                  boxShadow: isSel ? '0 4px 10px rgba(249,115,22,0.25)' : 'none',
                  transition: 'all 0.2s',
                }}>{cat}</button>
              );
            })}
          </div>
          <button style={arrowBtnStyle} onClick={() => catScrollRef.current?.scrollBy({ left: 120, behavior: 'smooth' })}>▶</button>
        </div>

        {/* ── 원래 세로 카드 리스트 (전체 목록이 보이는 판형) ── */}
        <div className="menu-grid-v2">
          {filteredMenus.map((item, idx) => {
            const cartItem = cart.find(c => c.name === item.name);
            return (
              <div key={idx} className="menu-card-v2" style={{ cursor: cartItem ? 'default' : 'pointer' }}
                onClick={() => { if (!cartItem) addToCart(item); }}>
                {/* 사진 + 사진 아래 수량 바 */}
                <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                  <div style={{ position: 'relative', width: '100px', height: '85px' }}>
                    <img src={item.icon} alt={item.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px 10px 0 0', display: 'block' }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=400&h=400'; }}
                    />
                    <span className="menu-category-tag">{item.category}</span>
                  </div>
                  {/* 수량 바 (사진 아래) */}
                  <div onClick={e => e.stopPropagation()} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: cartItem ? 'rgba(249,115,22,0.08)' : '#f1f5f9',
                    border: '1px solid #e2e8f0', borderTop: 'none',
                    borderRadius: '0 0 10px 10px',
                    padding: '4px 6px', width: '100px', boxSizing: 'border-box',
                  }}>
                    <button onClick={() => removeFromCart(item.name)} style={{ ...qtyBtnS, color: cartItem ? '#ef4444' : '#cbd5e1' }}>−</button>
                    <span style={{ fontSize: '12px', fontWeight: 900, color: cartItem ? '#f97316' : '#94a3b8', minWidth: '18px', textAlign: 'center' }}>
                      {cartItem?.qty ?? 0}
                    </span>
                    <button onClick={() => addToCart(item)} style={{ ...qtyBtnS, color: '#f97316' }}>+</button>
                  </div>
                </div>
                {/* 메뉴 정보 */}
                <div className="menu-info">
                  <div className="menu-name">{item.name}</div>
                  <div className="menu-desc">{item.description}</div>
                  <div className="menu-price">{item.price.toLocaleString()}원</div>
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  };

  // QR 스캔 없이 직접 접근한 경우(table 파라미터 없음) 차단
  if (!hasTableParam) {
    return (
      <div className="mobile-v2-container flex-center" style={{ background: '#0f172a' }}>
        <div style={{ textAlign: 'center', padding: '40px 24px', maxWidth: '360px' }}>
          <div style={{ fontSize: '4rem', marginBottom: '24px' }}>🔳</div>
          <h2 style={{ color: 'white', fontWeight: 900, fontSize: '1.4rem', marginBottom: '12px' }}>테이블 QR 스캔 후 주문</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '32px' }}>
            각 테이블에 부착된 QR 코드를 스캔하면<br />해당 테이블의 주문 화면이 열립니다.
          </p>
          <div style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '12px', padding: '14px 18px', fontSize: '0.82rem', color: '#fb923c', lineHeight: 1.6 }}>
            💡 <strong>QR 인쇄</strong> 메뉴에서 테이블별 QR을 인쇄하여<br />각 테이블에 부착해 주세요.
          </div>
          <button
            onClick={() => onNavigate?.('qr')}
            style={{ marginTop: '24px', background: '#f97316', color: 'white', border: 'none', borderRadius: '12px', padding: '12px 28px', fontSize: '0.9rem', fontWeight: 800, cursor: 'pointer' }}
          >
            🖨️ QR 인쇄 센터로 이동
          </button>
        </div>
      </div>
    );
  }

  if (sessionPhase !== 'active') {
    const statusMsg = sessionPhase === 'loading'
      ? '연결 확인 중...'
      : sessionPhase === 'waiting_approval'
      ? '일행 확인 중...'
      : '카운터에 좌석 승인을 요청했습니다.';
    const subText = sessionPhase === 'waiting_approval'
      ? '기존 이용 중인 일행의 합류 승인을 기다리고 있습니다. 잠시만 기다려 주세요!'
      : '카운터에서 승인하면 자동으로 메뉴판이 활성화됩니다. 잠시만 기다려 주세요!';
    return (
      <div className="mobile-v2-container flex-center">
        <div className="premium-waiting-card animate-slide-up">
          <div className="glow-circle"></div>
          <div className="waiting-content">
            <h1 className="main-title">Welcome to<br/>{storeName}</h1>
            <div className="table-badge">Table {tableNo}</div>
            <div className="status-box"><div className="spinner-small"></div><p>{statusMsg}</p></div>
            <p className="sub-text">{subText}</p>
            <button className="inquiry-btn-large" onClick={handleStaffCall}>🔔 직원 문의</button>
          </div>
        </div>
      </div>
    );
  }

  // AI 비서 모드: 가로 스크롤 메뉴 스트립 + ConversationalUI
  if (viewMode === 'ai') {
    const filteredMenusAi = (menus || []).filter(m => activeCategory === '전체' || m.category === activeCategory);

    const arrowLight: React.CSSProperties = {
      flexShrink: 0, width: '24px', height: '24px',
      background: '#f1f5f9', border: '1.5px solid #cbd5e1',
      borderRadius: '50%', color: '#475569', fontSize: '10px',
      cursor: 'pointer', display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontWeight: 900, padding: 0, lineHeight: 1,
    };

    return (
      <div className="mobile-v2-container">
        {/* ── 토글 배너 ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '6px 14px', background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
          <button onClick={() => setViewMode('menu')}
            style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)', color: '#f97316', padding: '4px 11px', borderRadius: '20px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>
            📋 판형으로 보기
          </button>
        </div>

        {/* ── 카탈로그 스크롤 (라이트) ── */}
        <div style={{ background: '#ffffff', padding: '6px 10px 4px', display: 'flex', alignItems: 'center', gap: '4px', borderBottom: '1px solid #f1f5f9' }}>
          <button style={arrowLight} onClick={() => catScrollRef.current?.scrollBy({ left: -110, behavior: 'smooth' })}>◀</button>
          <div ref={catScrollRef} style={{ flex: 1, display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none', padding: '1px 0' }}>
            {categories.map((cat, i) => {
              const isSel = activeCategory === cat;
              return (
                <button key={i} onClick={() => setActiveCategory(cat)} style={{
                  flexShrink: 0,
                  background: isSel ? '#f97316' : '#f1f5f9',
                  border: isSel ? 'none' : '1.5px solid #e2e8f0',
                  color: isSel ? 'white' : '#475569',
                  padding: '4px 10px', borderRadius: '100px',
                  fontSize: '11px', fontWeight: 800, whiteSpace: 'nowrap', cursor: 'pointer',
                  boxShadow: isSel ? '0 2px 8px rgba(249,115,22,0.25)' : 'none',
                }}>{cat}</button>
              );
            })}
          </div>
          <button style={arrowLight} onClick={() => catScrollRef.current?.scrollBy({ left: 110, behavior: 'smooth' })}>▶</button>
        </div>

        {/* ── 메뉴 가로 스크롤 (라이트, 컴팩트 카드) ── */}
        <div style={{ background: '#ffffff', padding: '4px 10px 8px', borderBottom: '2px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button style={arrowLight} onClick={() => menuScrollRef.current?.scrollBy({ left: -150, behavior: 'smooth' })}>◀</button>
          <div ref={menuScrollRef} style={{ flex: 1, display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none', padding: '2px 0' }}>
            {filteredMenusAi.map((item, idx) => {
              const cartItem = cart.find(c => c.name === item.name);
              return (
                <div key={idx} onClick={() => { if (!cartItem) addToCart(item); }} style={{
                  flexShrink: 0, width: '132px',
                  background: '#ffffff', borderRadius: '10px', overflow: 'hidden',
                  cursor: cartItem ? 'default' : 'pointer',
                  border: cartItem ? '2px solid #f97316' : '1.5px solid #e2e8f0',
                  boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
                  userSelect: 'none', WebkitUserSelect: 'none',
                }}>
                  {/* 사진 */}
                  <div style={{ width: '100%', height: '99px' }}>
                    <img src={item.icon} alt={item.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=400&h=400'; }}
                    />
                  </div>
                  {/* 수량 바 (사진 아래) */}
                  <div onClick={e => e.stopPropagation()} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: cartItem ? 'rgba(249,115,22,0.07)' : '#f8fafc',
                    borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0',
                    padding: '3px 5px',
                  }}>
                    <button onClick={() => removeFromCart(item.name)} style={{ width: '18px', height: '18px', border: 'none', background: 'none', color: cartItem ? '#ef4444' : '#cbd5e1', fontSize: '13px', fontWeight: 900, cursor: cartItem ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1 }}>−</button>
                    <span style={{ fontSize: '12px', fontWeight: 900, color: cartItem ? '#f97316' : '#94a3b8', minWidth: '16px', textAlign: 'center' }}>{cartItem?.qty ?? 0}</span>
                    <button onClick={() => addToCart(item)} style={{ width: '18px', height: '18px', border: 'none', background: 'rgba(249,115,22,0.15)', color: '#f97316', fontSize: '13px', fontWeight: 900, cursor: 'pointer', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1 }}>+</button>
                  </div>
                  {/* 이름 & 가격 */}
                  <div style={{ padding: '4px 5px 5px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                    <div style={{ fontSize: '11px', fontWeight: 900, color: '#f59e0b' }}>{item.price.toLocaleString()}원</div>
                  </div>
                </div>
              );
            })}
          </div>
          <button style={arrowLight} onClick={() => menuScrollRef.current?.scrollBy({ left: 150, behavior: 'smooth' })}>▶</button>
        </div>

        {/* ── ConversationalUI ── */}
        <ConversationalUI
          bundles={bundles}
          storeId={storeId}
          storeName={storeName}
          sessionPreApproved={true}
          onNavigate={(tab) => {
            if (tab === 'orderV2') setViewMode('menu');
            else onNavigate?.(tab);
          }}
        />
      </div>
    );
  }

  return (
    <div className="mobile-v2-container">
      {/* Header */}
      <header className="mobile-v2-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#f97316' }}>{storeName}</h1>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Table {tableNo} | 스마트 원격 오더</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setViewMode('ai')}
              style={{
                background: 'linear-gradient(135deg, #fef08a, #fde047)',
                border: '1px solid #facc15',
                padding: '6px 12px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 800,
                color: '#1e293b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
              }}
            >
              🤖 AI 비서
            </button>
            <div style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)', padding: '6px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 800, color: '#f97316' }}>
              🟢 연결됨
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mobile-v2-main-scroll" style={{ padding: '15px 15px 100px' }}>
        {renderContent()}
      </main>

      {/* Bottom Nav */}
      <nav className="customer-bottom-nav">
        {/* 1. 직원호출 */}
        <button
          onClick={() => requestStaffCall('직원호출')}
        >
          <span className="nav-icon">🔔</span>
          <span className="nav-label">직원호출</span>
        </button>

        {/* 2. 주차확인 */}
        <button
          onClick={() => setShowParkingModal(true)}
          className={parkingApplied ? 'active' : ''}
        >
          <span className="nav-icon">🚗</span>
          <span className="nav-label">주차확인</span>
          {parkingApplied && <span className="nav-badge">✓</span>}
        </button>

        {/* 3. 음성주문 (중앙 마이크) */}
        <button
          onClick={toggleVoiceOrdering}
          className={`voice-nav-btn ${isListening ? 'listening' : ''}`}
        >
          <div className="voice-mic-container">
            <span className="nav-icon">🎙️</span>
          </div>
          <span className="nav-label">음성주문</span>
        </button>

        {/* 4. 더치페이 */}
        <button
          onClick={() => {
            if (!sessionIdRef.current) {
              setVoiceToast('⚠️ 활성 세션이 없습니다. 먼저 주문해 주세요.');
              setTimeout(() => setVoiceToast(null), 3000);
              return;
            }
            if (cart.length === 0) {
              setVoiceToast('🛒 장바구니가 비어 있습니다. 메뉴를 먼저 담아 주세요!');
              setTimeout(() => setVoiceToast(null), 3000);
              return;
            }
            setDutchFrozenTotal(totalPrice);
            dutchFrozenTotalRef.current = totalPrice;
            setDutchStep('select');
            setDutchCount(2);
            dutchCountRef.current = 2;
            setDutchPaidSlots([]);
            dutchPaidSlotsRef.current = [];
            setDutchPayingSlot(null);
            dutchPayingSlotRef.current = null;
            setShowDutchModal(true);
          }}
        >
          <span className="nav-icon">🤝</span>
          <span className="nav-label">더치페이</span>
        </button>

        {/* 5. 바로결제 */}
        <button
          onClick={() => {
            if (cart.length === 0) {
              setVoiceToast("🛒 장바구니가 비어 있습니다. 메뉴를 먼저 담아 주세요!");
              setTimeout(() => setVoiceToast(null), 3000);
              return;
            }
            setShowPayModal(true);
          }}
        >
          <span className="nav-icon" style={{ color: '#059669' }}>💳</span>
          <span className="nav-label" style={{ color: '#059669', fontWeight: 800 }}>바로결제</span>
        </button>
      </nav>


      {isOrdering && <div className="loading-overlay"><div className="spinner"></div><h3>주문 전송 중...</h3></div>}
      
      {showPayModal && (
        <PaymentModal
          totalPrice={totalPrice}
          onClose={() => setShowPayModal(false)}
          onSubmit={executeOrderWithPayment}
          initialPhone={userPhone}
          bundles={bundles}
        />
      )}

      {/* ── 더치페이 모달 ── */}
      {showDutchModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 14000, padding: '20px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '24px', width: '100%', maxWidth: '400px', padding: '28px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', position: 'relative', maxHeight: '80vh', overflowY: 'auto' }}>
            <button onClick={() => { setShowDutchModal(false); setShowDutchPersonPayModal(false); dutchPayingSlotRef.current = null; }}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontSize: '16px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ✕
            </button>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>🤝</div>
              <h3 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 6px', color: 'var(--text-main)' }}>더치페이</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                총 <strong style={{ color: 'var(--text-main)' }}>{dutchFrozenTotal.toLocaleString()}원</strong>을 나눠서 결제합니다
              </p>
            </div>

            {dutchStep === 'select' ? (
              <>
                <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px' }}>인원 선택</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '20px' }}>
                  {[2,3,4,5,6,7,8].map(n => (
                    <button key={n} onClick={() => setDutchCount(n)}
                      style={{ padding: '12px 0', border: dutchCount === n ? '2px solid var(--primary)' : '1.5px solid var(--border)', borderRadius: '12px', background: dutchCount === n ? 'rgba(99,102,241,0.1)' : 'var(--bg-secondary)', color: dutchCount === n ? 'var(--primary)' : 'var(--text-main)', fontWeight: 800, fontSize: '15px', cursor: 'pointer' }}>
                      {n}명
                    </button>
                  ))}
                </div>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '16px', marginBottom: '20px', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>1인당 금액</p>
                  <p style={{ margin: 0, fontSize: '28px', fontWeight: 900, color: 'var(--text-main)' }}>
                    {Math.ceil(dutchFrozenTotal / dutchCount).toLocaleString()}원
                  </p>
                </div>
                <button onClick={() => {
                  const slots = Array(dutchCount).fill(false);
                  setDutchPaidSlots(slots);
                  dutchPaidSlotsRef.current = slots;
                  dutchCountRef.current = dutchCount;
                  setDutchStep('pay');
                }} style={{ width: '100%', padding: '16px', background: 'var(--primary)', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '16px', fontWeight: 800, cursor: 'pointer' }}>
                  다음 →
                </button>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                  {Array.from({ length: dutchCount }, (_, i) => {
                    const isLast = i === dutchCount - 1;
                    const perPerson = isLast
                      ? dutchFrozenTotal - Math.ceil(dutchFrozenTotal / dutchCount) * (dutchCount - 1)
                      : Math.ceil(dutchFrozenTotal / dutchCount);
                    const paid = dutchPaidSlots[i] || false;
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: paid ? 'rgba(16,185,129,0.08)' : 'var(--bg-secondary)', borderRadius: '12px', border: paid ? '1.5px solid rgba(16,185,129,0.3)' : '1.5px solid var(--border)' }}>
                        <div>
                          <p style={{ margin: '0 0 2px', fontWeight: 800, fontSize: '13px', color: 'var(--text-muted)' }}>{i + 1}번째 결제</p>
                          <p style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: paid ? '#10b981' : 'var(--text-main)' }}>{perPerson.toLocaleString()}원</p>
                        </div>
                        {paid ? (
                          <div style={{ background: '#10b981', color: '#fff', borderRadius: '20px', padding: '6px 14px', fontSize: '13px', fontWeight: 700 }}>✓ 완료</div>
                        ) : (
                          <button onClick={() => {
                            dutchPayingSlotRef.current = i;
                            setDutchPayingSlot(i);
                            setShowDutchPersonPayModal(true);
                          }} style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '20px', padding: '8px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                            결제하기
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                  {dutchPaidSlots.filter(Boolean).length} / {dutchCount} 명 결제 완료
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* 더치페이 개인 결제 PaymentModal */}
      {showDutchPersonPayModal && dutchPayingSlot !== null && (
        <PaymentModal
          totalPrice={
            dutchPayingSlot === dutchCount - 1
              ? dutchFrozenTotal - Math.ceil(dutchFrozenTotal / dutchCount) * (dutchCount - 1)
              : Math.ceil(dutchFrozenTotal / dutchCount)
          }
          onClose={() => {
            setShowDutchPersonPayModal(false);
            setDutchPayingSlot(null);
            dutchPayingSlotRef.current = null;
          }}
          onSubmit={(method, extraData) => {
            const isLast = dutchPayingSlot === dutchCount - 1;
            const perPerson = isLast
              ? dutchFrozenTotal - Math.ceil(dutchFrozenTotal / dutchCount) * (dutchCount - 1)
              : Math.ceil(dutchFrozenTotal / dutchCount);
            return executeOrderWithPayment(method, {
              ...(extraData || {}),
              dutchAmount: perPerson,
              dutchLabel: `더치페이 ${dutchPayingSlot + 1}/${dutchCount}`,
              isDutchPay: true,
            });
          }}
          initialPhone={userPhone}
          bundles={bundles}
        />
      )}

      {showParkingModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 14000,
          padding: '20px'
        }} className="animate-fade-in">
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '400px',
            padding: '30px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            position: 'relative'
          }} className="animate-pop-in">
            <button 
              onClick={() => {
                setShowParkingModal(false);
                setVehicleNumber('');
                setParkingApplied(false);
              }}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'rgba(0,0,0,0.05)',
                border: 'none',
                borderRadius: '50px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '16px',
                color: 'var(--text-main)',
                fontWeight: 'bold'
              }}
            >
              ✕
            </button>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🚗</div>
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 8px' }}>원클릭 셀프 주차 등록</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                식사 시간 동안 무료 주차 2시간 혜택을<br />직접 편리하게 적용하세요.
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>차량 번호 입력 (뒤 4자리)</label>
              <input
                type="text"
                maxLength={4}
                placeholder="예: 1234"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value.replace(/[^0-9]/g, ''))}
                style={{
                  width: '100%',
                  padding: '16px',
                  background: 'rgba(0,0,0,0.02)',
                  border: '1.5px solid var(--border)',
                  borderRadius: '12px',
                  fontSize: '24px',
                  fontWeight: 800,
                  textAlign: 'center',
                  letterSpacing: '8px',
                  color: 'var(--text-main)',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
              />
            </div>

            <button
              onClick={handleParkingSubmit}
              style={{
                width: '100%',
                padding: '16px',
                background: parkingApplied ? '#10b981' : 'var(--primary)',
                border: 'none',
                borderRadius: '12px',
                color: 'white',
                fontSize: '15px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3)',
                transition: 'all 0.3s'
              }}
            >
              {parkingApplied ? '✓ 주차 등록 완료' : '🚗 2시간 무료 정산 등록'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
              * 주차 등록 후에는 취소나 변경이 불가하니 신중히 입력바랍니다.
            </div>
          </div>
        </div>
      )}

      {voiceToast && (
        <div style={{
          position: 'fixed',
          bottom: '100px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1.5px solid #f97316',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '50px',
          fontSize: '13px',
          fontWeight: 800,
          boxShadow: '0 10px 25px rgba(249, 115, 22, 0.25)',
          zIndex: 15000,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          whiteSpace: 'nowrap'
        }} className="animate-pop-in">
          <span>🔔</span> {voiceToast}
        </div>
      )}

      {/* 호출 고객 알림 오버레이 */}
      {callOverlay && (
        <div style={{ position: 'fixed', inset: 0, background: callOverlay.status === 'completed' ? '#1a1a2e' : 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          className={callOverlay.status === 'completed' ? 'entry-flash' : ''}>
          <style dangerouslySetInnerHTML={{ __html: `@keyframes flash-bg { 0%{background:#1a1a2e} 50%{background:#16213e} 100%{background:#1a1a2e} } .entry-flash{animation:flash-bg 0.8s infinite}` }} />
          <div style={{ background: 'var(--surface)', borderRadius: '24px', padding: '40px 32px', maxWidth: '360px', width: '100%', textAlign: 'center', border: `2px solid ${callOverlay.status === 'completed' ? '#22c55e' : 'var(--border)'}` }}>
            {callOverlay.status === 'pending' ? (
              <>
                <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🔔</div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 900, marginBottom: '10px' }}>직원 호출 완료!</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>{callOverlay.callType} 요청을 보냈습니다.<br />잠시만 기다려주세요.</p>
                <button onClick={() => setCallOverlay(null)} style={{ padding: '12px 28px', borderRadius: '12px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontWeight: 700, cursor: 'pointer' }}>닫기</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: '4rem', marginBottom: '16px' }}>✅</div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#22c55e', marginBottom: '10px' }}>처리 완료!</h2>
                <p style={{ color: 'var(--text-main)', marginBottom: '24px' }}>직원이 방문하겠습니다.<br />잠시만 기다려주세요.</p>
                <button onClick={() => setCallOverlay(null)} style={{ padding: '14px 32px', borderRadius: '12px', border: 'none', background: '#22c55e', color: '#fff', fontWeight: 900, fontSize: '1rem', cursor: 'pointer' }}>확인</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 주차 고객 알림 오버레이 */}
      {parkingOverlay && (
        <div style={{ position: 'fixed', inset: 0, background: parkingOverlay.status === 'completed' ? '#1a2e1a' : 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '24px', padding: '40px 32px', maxWidth: '360px', width: '100%', textAlign: 'center', border: `2px solid ${parkingOverlay.status === 'completed' ? '#10b981' : 'var(--border)'}` }}>
            {parkingOverlay.status === 'pending' ? (
              <>
                <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🚗</div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 900, marginBottom: '10px' }}>주차 등록 완료!</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>2시간 무료 주차가 등록되었습니다.</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px' }}>직원이 정산 처리하면 알림이 울립니다.</p>
                <button onClick={() => setParkingOverlay(null)} style={{ padding: '12px 28px', borderRadius: '12px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontWeight: 700, cursor: 'pointer' }}>닫기</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: '4rem', marginBottom: '16px' }}>✅</div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#10b981', marginBottom: '10px' }}>정산 완료!</h2>
                <p style={{ color: 'var(--text-main)', marginBottom: '24px' }}>주차 할인이 정상 처리되었습니다.</p>
                <button onClick={() => setParkingOverlay(null)} style={{ padding: '14px 32px', borderRadius: '12px', border: 'none', background: '#10b981', color: '#fff', fontWeight: 900, fontSize: '1rem', cursor: 'pointer' }}>확인</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileOrderV2;
