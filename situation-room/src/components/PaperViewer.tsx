import React, { useEffect, useState } from 'react';

export const PaperViewer: React.FC = () => {
    const [content, setContent] = useState<string>('로딩 중...');

    useEffect(() => {
        fetch('http://localhost:8000/api/paper')
            .then(res => res.json())
            .then(data => {
                if (data.content) {
                    setContent(data.content);
                } else {
                    setContent('논문 파일을 찾을 수 없습니다.');
                }
            })
            .catch(() => setContent('서버 연결 오류가 발생했습니다.'));
    }, []);

    return (
        <div className="paper-viewer-container animate-fade-in" style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
            <header className="page-header" style={{ textAlign: 'center', marginBottom: '40px' }}>
                <h1 style={{ fontSize: '2.5rem', color: 'white', marginBottom: '10px' }}>📄 학술 논문 및 시스템 아키텍처</h1>
                <p style={{ color: 'var(--accent-orange)', fontWeight: 'bold' }}>AI 지능형 운영 시스템: U.C.E (Universal CodeLess Engine)</p>
            </header>

            <div className="glass-panel paper-content-card" style={{ 
                padding: '40px', 
                background: 'rgba(30, 41, 59, 0.5)', 
                lineHeight: '1.8', 
                fontSize: '1.1rem',
                color: '#e2e8f0',
                whiteSpace: 'pre-wrap',
                fontFamily: 'serif'
            }}>
                {content}
            </div>

            <footer style={{ marginTop: '50px', textAlign: 'center', opacity: 0.5, paddingBottom: '100px' }}>
                <p>© 2026 AI Situation Room Research Lab. All rights reserved.</p>
            </footer>
        </div>
    );
};
