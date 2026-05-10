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
}

export const AdminStoreManager = ({ onSelectStore, onLogout }: AdminStoreManagerProps) => {
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

    const payload = {
      store_id: formStoreId,
      store_name: formStoreName,
      owner_name: formOwnerName,
      owner_id: formOwnerId,
      monthly_fee: Number(formMonthlyFee),
      payment_status: formPaymentStatus,
      payment_history: editingStore ? (typeof editingStore.payment_history === 'string' ? JSON.parse(editingStore.payment_history) : editingStore.payment_history) : []
    };

    try {
      const url = editingStore 
        ? `${API_BASE}/api/stores/${formStoreId}`
        : `${API_BASE}/api/stores`;
      
      const method = editingStore ? 'PUT' : 'POST';

      // If adding new store, send complete model including store_id
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

  return (
    <div className="admin-stores-container animate-fade-in" style={{ padding: '40px 20px', background: 'var(--bg-main)', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: '1200px' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '2.5rem' }}>🏢</span>
              <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-main)', margin: 0, letterSpacing: '-1px' }}>
                프랜차이즈 가맹점 본사 관리 시스템
              </h1>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: '5px 0 0 45px' }}>
              가맹점의 정산 ID, 월 임대 정산금 납부 상태를 한눈에 통제하고 개별 매장 상황실 대시보드로 즉시 진입합니다.
            </p>
          </div>
          
          <button 
            onClick={onLogout}
            style={{
              padding: '12px 20px',
              borderRadius: '12px',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1.5px solid rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            🔓 시스템 로그아웃
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '15px' }}>
          <input
            type="text"
            placeholder="🔍 매장명, 점주명, ID로 신속 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '14px 20px',
              borderRadius: '14px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-main)',
              width: '350px',
              maxWidth: '100%',
              fontSize: '0.95rem',
              boxShadow: 'var(--shadow-sm)',
              outline: 'none'
            }}
          />

          <button
            onClick={openAddModal}
            style={{
              padding: '14px 24px',
              borderRadius: '14px',
              background: 'var(--primary)',
              color: 'white',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 8px 16px rgba(59, 130, 246, 0.25)',
              transition: 'transform 0.2s, background 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            ➕ 신규 가맹점 등록
          </button>
        </div>

        {/* Stores List */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '100px 0' }}>
            <div className="spinner" style={{ margin: '0 auto 20px' }}></div>
            <p style={{ color: 'var(--text-muted)' }}>가맹점 DB 정보를 실시간으로 조회하고 있습니다...</p>
          </div>
        ) : filteredStores.length === 0 ? (
          <div className="glass-card" style={{ padding: '80px 20px', textAlign: 'center', borderRadius: '20px', border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '15px' }}>🔍</span>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-main)' }}>매칭되는 가맹점 정보가 없습니다.</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '5px' }}>검색어를 변경하시거나 신규 매장을 생성해 주세요.</p>
          </div>
        ) : (
          <div className="glass-card" style={{ borderRadius: '20px', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)', boxShadow: 'var(--shadow-md)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '18px 24px', fontWeight: 800, color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase' }}>매장 ID</th>
                    <th style={{ padding: '18px 24px', fontWeight: 800, color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase' }}>가맹 매장명</th>
                    <th style={{ padding: '18px 24px', fontWeight: 800, color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase' }}>점주명 (ID)</th>
                    <th style={{ padding: '18px 24px', fontWeight: 800, color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase' }}>월 사용료</th>
                    <th style={{ padding: '18px 24px', fontWeight: 800, color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase' }}>납부 상태</th>
                    <th style={{ padding: '18px 24px', fontWeight: 800, color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', textAlign: 'right' }}>관리 도구</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStores.map(store => {
                    const isPaid = store.payment_status === '정상';
                    return (
                      <tr key={store.store_id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} className="table-row-hover">
                        <td style={{ padding: '18px 24px', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                          <code>{store.store_id}</code>
                        </td>
                        <td style={{ padding: '18px 24px' }}>
                          <span style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '1.1rem' }}>{store.store_name}</span>
                        </td>
                        <td style={{ padding: '18px 24px', color: 'var(--text-main)', fontWeight: 600, fontSize: '0.95rem' }}>
                          {store.owner_name} <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 400 }}>({store.owner_id})</span>
                        </td>
                        <td style={{ padding: '18px 24px', fontWeight: 800, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                          ₩{store.monthly_fee.toLocaleString()}
                        </td>
                        <td style={{ padding: '18px 24px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '4px 12px',
                            borderRadius: '50px',
                            background: isPaid ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                            color: isPaid ? '#10b981' : '#ef4444',
                            fontWeight: 800,
                            fontSize: '0.8rem',
                          }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isPaid ? '#10b981' : '#ef4444', display: 'inline-block' }}></span>
                            {store.payment_status}
                          </span>
                        </td>
                        <td style={{ padding: '18px 24px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => onSelectStore(store.store_id, store.store_name)}
                              style={{
                                padding: '8px 16px',
                                borderRadius: '10px',
                                background: 'linear-gradient(135deg, var(--accent) 0%, #2563eb 100%)',
                                color: 'white',
                                fontWeight: 800,
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                boxShadow: '0 4px 10px rgba(59, 130, 246, 0.15)'
                              }}
                            >
                              💻 상황실 진입
                            </button>
                            <button
                              onClick={() => openEditModal(store)}
                              style={{
                                padding: '8px 12px',
                                borderRadius: '10px',
                                background: 'rgba(0,0,0,0.03)',
                                border: '1px solid var(--border)',
                                color: 'var(--text-main)',
                                fontWeight: 700,
                                cursor: 'pointer',
                                fontSize: '0.85rem'
                              }}
                            >
                              ✏️ 편집
                            </button>
                            <button
                              onClick={() => handleDelete(store.store_id, store.store_name)}
                              style={{
                                padding: '8px 12px',
                                borderRadius: '10px',
                                background: 'rgba(239, 68, 68, 0.03)',
                                border: '1px solid rgba(239, 68, 68, 0.1)',
                                color: '#ef4444',
                                fontWeight: 700,
                                cursor: 'pointer',
                                fontSize: '0.85rem'
                              }}
                            >
                              ❌
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999
        }}>
          <div className="glass-card animate-scale-up" style={{
            background: 'var(--surface)', padding: '30px', borderRadius: '24px',
            width: '450px', maxWidth: '90%', border: '1px solid var(--border)',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 0, marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              {editingStore ? '✏️ 가맹 정보 수정' : '➕ 신규 가맹점 정보 등록'}
            </h2>

            <form onSubmit={handleSave}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>가맹 매장 ID</label>
                  <input
                    type="text"
                    value={formStoreId}
                    onChange={(e) => setFormStoreId(e.target.value.replace(/[^a-zA-Z0-9-]/g, ''))}
                    disabled={!!editingStore}
                    placeholder="예: store-1"
                    style={{
                      width: '100%', padding: '12px', borderRadius: '10px',
                      border: '1px solid var(--border)', background: formStoreId && editingStore ? '#f1f5f9' : 'var(--surface)',
                      color: 'var(--text-main)', outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>가맹 매장명 (상호명)</label>
                  <input
                    type="text"
                    value={formStoreName}
                    onChange={(e) => setFormStoreName(e.target.value)}
                    placeholder="예: 우정돌솥밥 역삼점"
                    style={{
                      width: '100%', padding: '12px', borderRadius: '10px',
                      border: '1px solid var(--border)', background: 'var(--surface)',
                      color: 'var(--text-main)', outline: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>점주명</label>
                    <input
                      type="text"
                      value={formOwnerName}
                      onChange={(e) => setFormOwnerName(e.target.value)}
                      placeholder="홍길동"
                      style={{
                        width: '100%', padding: '12px', borderRadius: '10px',
                        border: '1px solid var(--border)', background: 'var(--surface)',
                        color: 'var(--text-main)', outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>점주 ID</label>
                    <input
                      type="text"
                      value={formOwnerId}
                      onChange={(e) => setFormOwnerId(e.target.value)}
                      placeholder="owner-1"
                      style={{
                        width: '100%', padding: '12px', borderRadius: '10px',
                        border: '1px solid var(--border)', background: 'var(--surface)',
                        color: 'var(--text-main)', outline: 'none'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>월 사용 가맹금 (₩)</label>
                    <input
                      type="number"
                      value={formMonthlyFee}
                      onChange={(e) => setFormMonthlyFee(Number(e.target.value))}
                      style={{
                        width: '100%', padding: '12px', borderRadius: '10px',
                        border: '1px solid var(--border)', background: 'var(--surface)',
                        color: 'var(--text-main)', outline: 'none'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>월 납부 상태</label>
                    <select
                      value={formPaymentStatus}
                      onChange={(e) => setFormPaymentStatus(e.target.value)}
                      style={{
                        width: '100%', padding: '12px', borderRadius: '10px',
                        border: '1px solid var(--border)', background: 'var(--surface)',
                        color: 'var(--text-main)', outline: 'none', fontWeight: 700
                      }}
                    >
                      <option value="정상">정상 (Paid)</option>
                      <option value="미납">미납 (Unpaid)</option>
                    </select>
                  </div>
                </div>

              </div>

              {formMessage && (
                <div style={{ marginTop: '15px', color: formMessage.includes('❌') ? '#ef4444' : '#10b981', fontWeight: 700, fontSize: '0.85rem', textAlign: 'center' }}>
                  {formMessage}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '25px', borderTop: '1px solid var(--border)', paddingTop: '15px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '12px 18px', borderRadius: '10px',
                    background: 'rgba(0,0,0,0.03)', border: '1px solid var(--border)',
                    color: 'var(--text-main)', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '12px 24px', borderRadius: '10px',
                    background: 'var(--primary)', color: 'white',
                    fontWeight: 800, border: 'none', cursor: 'pointer',
                    boxShadow: '0 8px 16px rgba(59, 130, 246, 0.2)'
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
