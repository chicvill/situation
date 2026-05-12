import { useEffect, useState, useMemo, type FormEvent } from 'react';
import { API_BASE } from '../config';

interface Store {
  store_id: string;
  store_name: string;
  owner_name: string;
  owner_id: string;
  monthly_fee: number;
  payment_status: string;
  payment_history: any[] | string;
  timestamp: string;
}

interface AdminStoreManagerProps {
  onSelectStore: (storeId: string, storeName: string) => void;
  onLogout: () => void;
  bundles?: any[];
}

export const AdminStoreManager = ({ onSelectStore, onLogout, bundles = [] }: AdminStoreManagerProps) => {
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  
  // Form fields
  const [formStoreId, setFormStoreId] = useState('');
  const [formStoreName, setFormStoreName] = useState('');
  const [formOwnerName, setFormOwnerName] = useState('');
  const [formOwnerId, setFormOwnerId] = useState('');
  const [formMonthlyFee, setFormMonthlyFee] = useState(50000);
  const [formPaymentStatus, setFormPaymentStatus] = useState('정상');
  const [formMessage, setFormMessage] = useState('');

  // 가입 대기 점주 목록 필터링
  const pendingOwners = useMemo(() => {
    return bundles.filter(b => {
      if (b.type !== 'PersonalInfos' || b.status === 'approved') return false;
      const role = b.items.find((i: any) => i.name === '권한')?.value;
      return role === 'owner';
    });
  }, [bundles]);

  // 가입 승인 핸들러
  const handleApproveAndRegister = async (bundle: any) => {
    const ownerName = bundle.items.find((i: any) => i.name === '이름')?.value || '';
    if (!window.confirm(`✨ ${ownerName} 사장님의 가입 신청을 최종 승인하시겠습니까?\n승인 완료 후 해당 사장님이 본인의 계정으로 직접 본인의 매장(집)을 새로 등록 및 개설하게 됩니다.`)) return;
    
    setIsLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
      
      // 1. 점주 승인 (PUT /api/bundle/{id} with status: 'approved')
      const res = await fetch(`${apiUrl}/api/bundle/${bundle.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...bundle, status: 'approved' }),
      });
      
      if (!res.ok) {
        throw new Error('가입 승인 처리에 실패했습니다.');
      }
      
      alert(`🎉 ${ownerName} 사장님 가입 승인이 성공적으로 완료되었습니다!\n이제 해당 사장님이 로그인 시 본인만의 매장(집)을 직접 완공 및 가맹 세팅하실 수 있습니다.`);
      fetchStores();
    } catch (err: any) {
      console.error(err);
      alert(`❌ 오류: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStores = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/stores`);
      if (res.ok) {
        const data = await res.json();
        setStores(data);
      }
    } catch (err) {
      console.error('Fetch stores error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const openAddModal = () => {
    setEditingStore(null);
    setFormStoreId(`store-${Date.now().toString().slice(-4)}`);
    setFormStoreName('');
    setFormOwnerName('');
    setFormOwnerId('');
    setFormMonthlyFee(50000);
    setFormPaymentStatus('정상');
    setFormMessage('');
    setIsModalOpen(true);
  };

  const openEditModal = (store: Store) => {
    setEditingStore(store);
    setFormStoreId(store.store_id);
    setFormStoreName(store.store_name);
    setFormOwnerName(store.owner_name);
    setFormOwnerId(store.owner_id);
    setFormMonthlyFee(store.monthly_fee);
    setFormPaymentStatus(store.payment_status);
    setFormMessage('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setFormMessage('');
    
    if (!formStoreId.trim() || !formStoreName.trim() || !formOwnerName.trim() || !formOwnerId.trim()) {
      setFormMessage('❌ 모든 필드를 채워주세요.');
      return;
    }

    // Parse existing or set default history
    let existingHistory: any[] = [];
    if (editingStore) {
      if (typeof editingStore.payment_history === 'string') {
        try {
          existingHistory = JSON.parse(editingStore.payment_history);
        } catch {
          existingHistory = [];
        }
      } else if (Array.isArray(editingStore.payment_history)) {
        existingHistory = editingStore.payment_history;
      }
    } else {
      // For a new store, create a clean default history matching the selected status
      existingHistory = [
        {
          date: new Date().toISOString().slice(0, 10),
          amount: formPaymentStatus === '정상' ? Number(formMonthlyFee) : 0,
          status: formPaymentStatus === '정상' ? '완료' : (formPaymentStatus === '미납' ? '미납' : '연체')
        }
      ];
    }

    const payload = {
      store_id: formStoreId,
      store_name: formStoreName,
      owner_name: formOwnerName,
      owner_id: formOwnerId,
      monthly_fee: Number(formMonthlyFee),
      payment_status: formPaymentStatus,
      payment_history: existingHistory
    };

    try {
      const url = editingStore 
        ? `${API_BASE}/api/stores/${formStoreId}`
        : `${API_BASE}/api/stores`;
      
      const method = editingStore ? 'PUT' : 'POST';

      const bodyPayload = editingStore 
        ? {
            store_name: formStoreName,
            owner_name: formOwnerName,
            owner_id: formOwnerId,
            monthly_fee: Number(formMonthlyFee),
            payment_status: formPaymentStatus,
            payment_history: payload.payment_history
          }
        : payload;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchStores();
      } else {
        const errData = await res.json();
        setFormMessage(`❌ 실패: ${errData.detail || '오류 발생'}`);
      }
    } catch (err) {
      setFormMessage('❌ 서버 전송 오류가 발생했습니다.');
    }
  };

  const handleDelete = async (storeId: string, name: string) => {
    if (!window.confirm(`⚠️ 정말로 '${name}' 매장을 가맹 목록에서 완전 삭제하시겠습니까?\n이 매장의 모든 대기/주차/주문 정보가 유실될 수 있습니다.`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/stores/${storeId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchStores();
      } else {
        alert('삭제에 실패했습니다.');
      }
    } catch (err) {
      console.error('Delete store error:', err);
    }
  };

  const filteredStores = useMemo(() => {
    return stores.filter(s => 
      s.store_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.owner_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.store_id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [stores, searchQuery]);

  // Dashboard Stats calculation
  const stats = useMemo(() => {
    const total = stores.length;
    const paid = stores.filter(s => s.payment_status === '정상').length;
    const unpaid = stores.filter(s => s.payment_status === '미납').length;
    const overdue = stores.filter(s => s.payment_status === '연체').length;
    const totalRevenue = stores
      .filter(s => s.payment_status === '정상')
      .reduce((sum, s) => sum + s.monthly_fee, 0);

    return { total, paid, unpaid, overdue, totalRevenue };
  }, [stores]);

  // Helper to map store id or name to a beautiful emoji logo
  const getStoreLogo = (id: string, name: string) => {
    if (id.includes('korean') || name.includes('수라간') || name.includes('한식')) return '🍱';
    if (id.includes('coffee') || name.includes('커피') || name.includes('카페')) return '☕';
    if (id.includes('beef') || name.includes('한우') || name.includes('고기')) return '🥩';
    if (id.includes('tofu') || name.includes('순두부') || name.includes('두부')) return '🥣';
    if (id.includes('bibim') || name.includes('비빔밥') || name.includes('돌솥')) return '🍚';
    return '🏢';
  };

  return (
    <div className="admin-stores-container animate-fade-in" style={{ padding: '40px 20px', background: 'var(--bg-main)', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: '"Pretendard", -apple-system, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '1200px' }}>
        
        {/* Top Glow Accent Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '35px', flexWrap: 'wrap', gap: '20px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', padding: '30px 40px', borderRadius: '24px', boxShadow: '0 15px 30px rgba(15, 23, 42, 0.15)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '2.5rem', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))' }}>⚡</span>
              <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: '#f8fafc', margin: 0, letterSpacing: '-1px', textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                프랜차이즈 가맹점 본사 관리 시스템
              </h1>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.98rem', margin: '8px 0 0 50px', fontWeight: 500 }}>
              가맹점 정산 ID 및 월 납부금 상태를 통제하고 매장 개별 상황판으로 즉시 원격 진입합니다.
            </p>
          </div>
          
          <button 
            onClick={onLogout}
            style={{
              padding: '12px 24px',
              borderRadius: '14px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1.5px solid rgba(239, 68, 68, 0.25)',
              color: '#fca5a5',
              fontWeight: 800,
              cursor: 'pointer',
              fontSize: '0.95rem',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.1)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#ef4444';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
              e.currentTarget.style.color = '#fca5a5';
            }}
          >
            🔓 시스템 로그아웃
          </button>
        </div>

        {/* Stats Summary Widget Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '35px' }}>
          
          {/* Card 1: Total */}
          <div style={{ background: '#ffffff', padding: '24px', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', width: '56px', height: '56px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem' }}>
              🏢
            </div>
            <div>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', display: 'block' }}>전체 관리 가맹점</span>
              <span style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f172a' }}>{stats.total}개소</span>
            </div>
          </div>

          {/* Card 2: Paid */}
          <div style={{ background: '#ffffff', padding: '24px', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', width: '56px', height: '56px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem' }}>
              🟢
            </div>
            <div>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', display: 'block' }}>정상 납부 매장</span>
              <span style={{ fontSize: '1.8rem', fontWeight: 900, color: '#10b981' }}>{stats.paid}개소</span>
            </div>
          </div>

          {/* Card 3: Unpaid & Overdue */}
          <div style={{ background: '#ffffff', padding: '24px', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', width: '56px', height: '56px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem' }}>
              🚨
            </div>
            <div>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', display: 'block' }}>미납 / 연체 관리</span>
              <span style={{ fontSize: '1.8rem', fontWeight: 900, color: '#ef4444' }}>{stats.unpaid + stats.overdue}개소</span>
            </div>
          </div>

          {/* Card 4: Expected Revenue */}
          <div style={{ background: '#ffffff', padding: '24px', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', width: '56px', height: '56px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem' }}>
              🪙
            </div>
            <div>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', display: 'block' }}>당월 회수 가맹금</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#8b5cf6' }}>₩{stats.totalRevenue.toLocaleString()}</span>
            </div>
          </div>

        </div>

        {/* Pending Approvals Section */}
        {pendingOwners.length > 0 && (
          <div className="glass-panel" style={{
            background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.08) 0%, rgba(249, 115, 22, 0.03) 100%)',
            border: '1.5px solid rgba(249, 115, 22, 0.25)',
            borderRadius: '24px',
            padding: '28px 32px',
            marginBottom: '35px',
            boxShadow: '0 12px 30px rgba(249, 115, 22, 0.05)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <span style={{ fontSize: '1.8rem' }}>🏢</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-orange)' }}>
                  신규 점주 가입 신청 승인 대기 ({pendingOwners.length}건)
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#64748b', fontWeight: 500 }}>
                  승인 시 계정이 활성화되며 즉시 신규 매장(가맹점) 등록 절차로 자동 연결됩니다.
                </p>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
              {pendingOwners.map(b => {
                const name = b.items.find((i: any) => i.name === '이름')?.value || '-';
                const id = b.items.find((i: any) => i.name === '아이디')?.value || '-';
                const bizNo = b.items.find((i: any) => i.name === '사업자번호')?.value || '-';
                const openDate = b.items.find((i: any) => i.name === '개업일자')?.value || '-';
                const storeName = b.store || '-';
                
                return (
                  <div key={b.id} style={{ 
                    background: '#ffffff', 
                    padding: '20px', 
                    borderRadius: '18px', 
                    boxShadow: '0 4px 15px rgba(0,0,0,0.02)', 
                    border: '1px solid rgba(249, 115, 22, 0.12)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '15px'
                  }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ background: 'rgba(249, 115, 22, 0.1)', color: 'var(--accent-orange)', padding: '4px 10px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 800 }}>
                          신청 매장: {storeName}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>{b.timestamp || '방금 전'}</span>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ fontSize: '0.92rem', color: '#334155', fontWeight: 500 }}>
                          <span style={{ color: '#94a3b8', width: '90px', display: 'inline-block' }}>👤 대표자명</span>
                          <strong style={{ color: '#0f172a', fontSize: '1rem' }}>{name}</strong> <span style={{ color: '#64748b', fontSize: '0.85rem' }}>({id})</span>
                        </div>
                        <div style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 500 }}>
                          <span style={{ color: '#94a3b8', width: '90px', display: 'inline-block' }}>🔢 사업자번호</span>
                          <code style={{ color: '#0f172a', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '0.82rem', fontWeight: 'bold' }}>{bizNo}</code>
                        </div>
                        <div style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 500 }}>
                          <span style={{ color: '#94a3b8', width: '90px', display: 'inline-block' }}>📅 개업일자</span>
                          <span style={{ color: '#334155' }}>{openDate}</span>
                        </div>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => handleApproveAndRegister(b)}
                      style={{ 
                        width: '100%',
                        padding: '12px',
                        background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '0.9rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: '0 4px 12px rgba(249, 115, 22, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 6px 15px rgba(249, 115, 22, 0.3)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(249, 115, 22, 0.2)';
                      }}
                    >
                      ✨ 가입 승인 및 매장 등록 시작
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Search & Actions Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
          <div style={{ position: 'relative', width: '400px', maxWidth: '100%' }}>
            <input
              type="text"
              placeholder="🔍 매장명, 점주명, ID로 신속 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '16px 20px 16px 48px',
                borderRadius: '16px',
                border: '1.5px solid #cbd5e1',
                background: '#ffffff',
                color: '#1e293b',
                width: '100%',
                fontSize: '1rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                outline: 'none',
                transition: 'all 0.2s',
                fontWeight: 500
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
            />
            <span style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', fontSize: '1.2rem', pointerEvents: 'none' }}></span>
          </div>

          <button
            onClick={openAddModal}
            style={{
              padding: '16px 28px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              color: 'white',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 10px 20px rgba(37, 99, 235, 0.2)',
              transition: 'transform 0.2s, boxShadow 0.2s',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 12px 24px rgba(37, 99, 235, 0.3)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 10px 20px rgba(37, 99, 235, 0.2)';
            }}
          >
            <span>➕</span> 신규 가맹점 등록
          </button>
        </div>

        {/* Premium Card Grid View */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '100px 0' }}>
            <div className="spinner" style={{ margin: '0 auto 20px' }}></div>
            <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>가맹점 DB 및 정산 데이터를 실시간으로 조회하고 있습니다...</p>
          </div>
        ) : filteredStores.length === 0 ? (
          <div style={{ padding: '80px 20px', textAlign: 'center', borderRadius: '24px', border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
            <span style={{ fontSize: '4rem', display: 'block', marginBottom: '15px' }}>🔍</span>
            <h3 style={{ margin: 0, fontSize: '1.3rem', color: '#1e293b', fontWeight: 800 }}>매칭되는 가맹점 정보가 없습니다.</h3>
            <p style={{ color: '#64748b', fontSize: '0.95rem', marginTop: '8px' }}>검색어를 변경하시거나 신규 매장을 생성해 주세요.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '28px' }}>
            {filteredStores.map(store => {
              const isPaid = store.payment_status === '정상';
              const isUnpaid = store.payment_status === '미납';
              
              // Safely parse payment history
              let historyList: any[] = [];
              if (store.payment_history) {
                if (typeof store.payment_history === 'string') {
                  try {
                    historyList = JSON.parse(store.payment_history);
                  } catch {
                    historyList = [];
                  }
                } else if (Array.isArray(store.payment_history)) {
                  historyList = store.payment_history;
                }
              }

              // Color mapping based on status
              const statusColors = {
                bg: isPaid ? 'rgba(16, 185, 129, 0.08)' : (isUnpaid ? 'rgba(245, 158, 11, 0.08)' : 'rgba(239, 68, 68, 0.08)'),
                text: isPaid ? '#10b981' : (isUnpaid ? '#f59e0b' : '#ef4444'),
                glow: isPaid ? '#10b981' : (isUnpaid ? '#f59e0b' : '#ef4444'),
                border: isPaid ? 'rgba(16, 185, 129, 0.15)' : (isUnpaid ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)')
              };

              return (
                <div 
                  key={store.store_id} 
                  style={{ 
                    background: '#ffffff', 
                    borderRadius: '24px', 
                    border: '1px solid #e2e8f0', 
                    padding: '28px', 
                    boxShadow: '0 8px 30px rgba(0,0,0,0.02)', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  className="store-dashboard-card"
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-6px)';
                    e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.06)';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.02)';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                >
                  
                  {/* Card Status Indicator Top Left line */}
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '5px', background: statusColors.text }} />

                  {/* Header: Logo, Name & ID */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', border: '1px solid #e2e8f0' }}>
                        {getStoreLogo(store.store_id, store.store_name)}
                      </div>
                      <div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>{store.store_name}</h2>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginTop: '2px' }}>
                          ID: <code style={{ color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem' }}>{store.store_id}</code>
                        </span>
                      </div>
                    </div>

                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '6px 14px',
                      borderRadius: '50px',
                      background: statusColors.bg,
                      color: statusColors.text,
                      border: `1px solid ${statusColors.border}`,
                      fontWeight: 800,
                      fontSize: '0.82rem',
                    }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: statusColors.glow, display: 'inline-block' }} />
                      {store.payment_status}
                    </span>
                  </div>

                  {/* Divider */}
                  <div style={{ height: '1px', background: '#f1f5f9', width: '100%', marginBottom: '18px' }} />

                  {/* Metadata Body */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '22px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem' }}>
                      <span style={{ color: '#64748b', fontWeight: 500 }}>대표 점주</span>
                      <span style={{ color: '#334155', fontWeight: 700 }}>
                        {store.owner_name} <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 400 }}>({store.owner_id})</span>
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem' }}>
                      <span style={{ color: '#64748b', fontWeight: 500 }}>월 정산 임대료</span>
                      <span style={{ color: '#0f172a', fontWeight: 900 }}>₩{store.monthly_fee.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Monthly Payment History Sub-Panel */}
                  <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '16px', border: '1px solid #f1f5f9', marginBottom: '24px', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '12px' }}>
                      📅 월별 수납 및 정산 이력 카드
                    </span>
                    
                    {historyList.length === 0 ? (
                      <div style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', padding: '15px 0', fontStyle: 'italic' }}>
                        정산 수납 데이터 이력이 아직 없습니다.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '130px', overflowY: 'auto', paddingRight: '4px' }}>
                        {historyList.map((hist, idx) => {
                          const hPaid = hist.status === '완료';
                          const hUnpaid = hist.status === '미납';
                          
                          return (
                            <div 
                              key={idx} 
                              style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                padding: '8px 12px', 
                                background: '#ffffff', 
                                borderRadius: '10px', 
                                border: '1px solid #e2e8f0', 
                                fontSize: '0.85rem' 
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: 700, color: '#475569' }}>{hist.date.slice(0, 7)}</span>
                                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>₩{hist.amount.toLocaleString()}</span>
                              </div>
                              <span style={{ 
                                fontWeight: 800, 
                                fontSize: '0.78rem',
                                color: hPaid ? '#10b981' : (hUnpaid ? '#f59e0b' : '#ef4444'),
                                background: hPaid ? 'rgba(16, 185, 129, 0.05)' : (hUnpaid ? 'rgba(245, 158, 11, 0.05)' : 'rgba(239, 68, 68, 0.05)'),
                                padding: '2px 8px',
                                borderRadius: '6px'
                              }}>
                                {hist.status === '완료' ? '완납' : (hist.status === '미납' ? '미납' : '연체')}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Primary Core Selection Button & Admin Tools Row */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto' }}>
                    
                    {/* 매장 선택 버튼 - 가장 강조된 프리미엄 액션 버튼 */}
                    <button
                      onClick={() => onSelectStore(store.store_id, store.store_name)}
                      style={{
                        width: '100%',
                        padding: '14px',
                        borderRadius: '14px',
                        background: isPaid ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : (isUnpaid ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'),
                        color: 'white',
                        fontWeight: 900,
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.95rem',
                        boxShadow: '0 6px 15px rgba(37, 99, 235, 0.15)',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.filter = 'brightness(1.08)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.filter = 'none';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <span>💻</span> {store.store_name} 선택 (상황판 진입)
                    </button>

                    {/* Secondary Tools Header row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <button
                        onClick={() => openEditModal(store)}
                        style={{
                          padding: '10px',
                          borderRadius: '12px',
                          background: '#ffffff',
                          border: '1.5px solid #cbd5e1',
                          color: '#475569',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          transition: 'all 0.15s'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = '#f8fafc';
                          e.currentTarget.style.borderColor = '#94a3b8';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = '#ffffff';
                          e.currentTarget.style.borderColor = '#cbd5e1';
                        }}
                      >
                        ✏️ 정보 편집
                      </button>
                      <button
                        onClick={() => handleDelete(store.store_id, store.store_name)}
                        style={{
                          padding: '10px',
                          borderRadius: '12px',
                          background: 'rgba(239, 68, 68, 0.02)',
                          border: '1.5px solid rgba(239, 68, 68, 0.15)',
                          color: '#ef4444',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          transition: 'all 0.15s'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = '#ef4444';
                          e.currentTarget.style.color = '#ffffff';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.02)';
                          e.currentTarget.style.color = '#ef4444';
                        }}
                      >
                        🗑️ 매장 삭제
                      </button>
                    </div>

                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(6px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999
        }}>
          <div className="glass-card animate-scale-up" style={{
            background: '#ffffff', padding: '35px', borderRadius: '28px',
            width: '480px', maxWidth: '90%', border: '1px solid #e2e8f0',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)'
          }}>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a', marginTop: 0, marginBottom: '22px', borderBottom: '1.5px solid #f1f5f9', paddingBottom: '14px', letterSpacing: '-0.5px' }}>
              {editingStore ? '✏️ 가맹 정보 수정' : '➕ 신규 가맹점 정보 등록'}
            </h2>

            <form onSubmit={handleSave}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '6px' }}>가맹 매장 ID</label>
                  <input
                    type="text"
                    value={formStoreId}
                    onChange={(e) => setFormStoreId(e.target.value.replace(/[^a-zA-Z0-9-]/g, ''))}
                    disabled={!!editingStore}
                    placeholder="예: store-1"
                    style={{
                      width: '100%', padding: '14px', borderRadius: '12px',
                      border: '1.5px solid #cbd5e1', background: formStoreId && editingStore ? '#f8fafc' : '#ffffff',
                      color: '#1e293b', outline: 'none', fontSize: '0.95rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '6px' }}>가맹 매장명 (상호명)</label>
                  <input
                    type="text"
                    value={formStoreName}
                    onChange={(e) => setFormStoreName(e.target.value)}
                    placeholder="예: 우정돌솥밥 역삼점"
                    style={{
                      width: '100%', padding: '14px', borderRadius: '12px',
                      border: '1.5px solid #cbd5e1', background: '#ffffff',
                      color: '#1e293b', outline: 'none', fontSize: '0.95rem'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '6px' }}>점주명</label>
                    <input
                      type="text"
                      value={formOwnerName}
                      onChange={(e) => setFormOwnerName(e.target.value)}
                      placeholder="홍길동"
                      style={{
                        width: '100%', padding: '14px', borderRadius: '12px',
                        border: '1.5px solid #cbd5e1', background: '#ffffff',
                        color: '#1e293b', outline: 'none', fontSize: '0.95rem'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '6px' }}>점주 ID</label>
                    <input
                      type="text"
                      value={formOwnerId}
                      onChange={(e) => setFormOwnerId(e.target.value)}
                      placeholder="owner-1"
                      style={{
                        width: '100%', padding: '14px', borderRadius: '12px',
                        border: '1.5px solid #cbd5e1', background: '#ffffff',
                        color: '#1e293b', outline: 'none', fontSize: '0.95rem'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '6px' }}>월 사용 가맹금 (₩)</label>
                    <input
                      type="number"
                      value={formMonthlyFee}
                      onChange={(e) => setFormMonthlyFee(Number(e.target.value))}
                      style={{
                        width: '100%', padding: '14px', borderRadius: '12px',
                        border: '1.5px solid #cbd5e1', background: '#ffffff',
                        color: '#1e293b', outline: 'none', fontSize: '0.95rem', fontWeight: 700
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '6px' }}>월 납부 상태</label>
                    <select
                      value={formPaymentStatus}
                      onChange={(e) => setFormPaymentStatus(e.target.value)}
                      style={{
                        width: '100%', padding: '14px', borderRadius: '12px',
                        border: '1.5px solid #cbd5e1', background: '#ffffff',
                        color: '#1e293b', outline: 'none', fontSize: '0.95rem', fontWeight: 800
                      }}
                    >
                      <option value="정상">정상 (Paid)</option>
                      <option value="미납">미납 (Unpaid)</option>
                      <option value="연체">연체 (Overdue)</option>
                    </select>
                  </div>
                </div>

              </div>

              {formMessage && (
                <div style={{ marginTop: '18px', color: formMessage.includes('❌') ? '#ef4444' : '#10b981', fontWeight: 800, fontSize: '0.88rem', textAlign: 'center' }}>
                  {formMessage}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '28px', borderTop: '1.5px solid #f1f5f9', paddingTop: '18px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '12px 20px', borderRadius: '12px',
                    background: '#f1f5f9', border: '1px solid #cbd5e1',
                    color: '#475569', fontWeight: 700, cursor: 'pointer',
                    fontSize: '0.95rem'
                  }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '12px 26px', borderRadius: '12px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', color: 'white',
                    fontWeight: 800, border: 'none', cursor: 'pointer',
                    boxShadow: '0 8px 16px rgba(59, 130, 246, 0.2)',
                    fontSize: '0.95rem'
                  }}
                >
                  {editingStore ? '저장 완료' : '등록 완료'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
