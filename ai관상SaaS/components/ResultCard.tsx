import React from 'react';
import { PhysiognomyResult } from '../types';
import { Printer, RefreshCcw, Save } from 'lucide-react';

interface ResultCardProps {
  result: PhysiognomyResult;
  userImage: string | null;
  onReset: () => void;
  onSave: () => void;
  isSaving: boolean;
}

const ResultCard: React.FC<ResultCardProps> = ({ result, userImage, onReset, onSave, isSaving }) => {
  const handlePrint = () => {
    window.print();
  };

  // Short date for small print (YY.MM.DD)
  const todayShort = new Date().toLocaleDateString('ko-KR', {
    year: '2-digit',
    month: 'numeric',
    day: 'numeric'
  }).replace(/\./g, '.').replace(/\s/g, '');

  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto h-full justify-center">
      
      {/* On-Screen Display Card - Wider and Single Screen Optimized */}
      <div className="bg-[#fffbf0] text-gray-900 rounded-2xl shadow-2xl p-6 w-full border-2 border-[#d4af37] relative overflow-hidden print:hidden flex flex-col gap-5">
        
        {/* Header Section: User Image & Main Result */}
        <div className="flex flex-row items-center justify-between border-b-2 border-gray-200 pb-4">
          <div className="flex-1">
             <div className="mb-2">
                <h2 className="text-2xl font-bold serif text-gray-900">AI 관상가</h2>
                <p className="text-xs text-gray-500">AI Convergence Education Center</p>
             </div>
             <div className="flex items-baseline gap-3">
               <span className="font-bold text-xl bg-[#f0e6d2] px-3 py-1 rounded-lg text-gray-700">당신의 동물상</span>
               <span className="text-4xl font-extrabold text-[#8b4513]">{result.animalType}</span>
             </div>
          </div>

          {/* User Image Circle */}
          <div className="w-24 h-24 rounded-full border-4 border-[#d4af37] shadow-lg overflow-hidden bg-gray-100 flex-shrink-0 ml-4">
            {userImage ? (
              <img src={userImage} alt="User" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gray-200" />
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-gray-700 text-lg italic text-center leading-relaxed">
          "{result.animalDescription}"
        </p>

        {/* 3-Column Grid for Luck Stats (Expanded Width) */}
        <div className="grid grid-cols-3 gap-4 w-full">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            {/* 글자 크기 2배 (text-2xl) */}
            <h4 className="font-bold text-2xl text-gray-800 mb-2 border-b border-gray-100 pb-2">재물운</h4>
            <p className="font-medium text-gray-600 text-sm leading-snug break-keep">{result.wealthLuck}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            {/* 글자 크기 2배 (text-2xl) */}
            <h4 className="font-bold text-2xl text-gray-800 mb-2 border-b border-gray-100 pb-2">애정운</h4>
            <p className="font-medium text-gray-600 text-sm leading-snug break-keep">{result.loveLuck}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            {/* 글자 크기 2배 (text-2xl) */}
            <h4 className="font-bold text-2xl text-gray-800 mb-2 border-b border-gray-100 pb-2">직업/학업</h4>
            <p className="font-medium text-gray-600 text-sm leading-snug break-keep">{result.careerLuck}</p>
          </div>
        </div>

        {/* Advice Section */}
        <div className="p-5 bg-gray-900 text-white rounded-xl text-center relative mt-1">
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-[#d4af37] text-black px-4 py-1 text-sm font-bold rounded-full shadow-lg">
            오늘의 조언
          </div>
          <p className="serif text-xl font-medium leading-relaxed pt-2 break-keep">
            "{result.advice}"
          </p>
        </div>

        {/* Action Buttons - Moved Inside for Single View */}
        <div className="grid grid-cols-3 gap-4 w-full mt-1">
          <button 
            onClick={onReset}
            className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg transition-colors"
          >
            <RefreshCcw size={18} />
            <span className="font-bold">처음으로</span>
          </button>
          
          <button 
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 bg-[#d4af37] hover:bg-[#b5952f] text-gray-900 font-bold py-3 rounded-lg transition-colors shadow-md"
          >
            <Printer size={18} />
            <span>출력하기</span>
          </button>

          <button 
            onClick={onSave}
            disabled={isSaving}
            className={`flex items-center justify-center gap-2 py-3 rounded-lg transition-colors text-white font-bold ${
              isSaving ? 'bg-green-700' : 'bg-green-600 hover:bg-green-500'
            }`}
          >
            <Save size={18} />
            <span>{isSaving ? '저장됨' : '서버저장'}</span>
          </button>
        </div>

      </div>

      {/* Printable Area - Optimized for 3.1" (approx 80mm) Square Sticky Note 
          Rotated 90 degrees for Nemonic printer alignment */}
      <div 
        id="printable-area" 
        className="hidden print:flex flex-col w-full h-full text-black justify-between p-1"
        style={{ transform: 'rotate(90deg)' }}
      >
        
        {/* Header */}
        <div className="flex justify-between items-end border-b-2 border-black pb-1 mb-2">
          <h1 className="text-xl font-black serif leading-none">AI 관상</h1>
          <span className="text-[10px] font-mono">{todayShort}</span>
        </div>

        <div className="flex-1 flex flex-col items-center w-full">
           {/* Top Info */}
           <div className="w-full flex items-center justify-between mb-4">
              <span className="text-sm font-bold bg-gray-200 px-1 rounded">동물형</span>
              <span className="text-xl font-black">{result.animalType}</span>
           </div>
           
           <hr className="border-black border-dashed w-full opacity-30 mb-6" />

           {/* Advice Section - Expanded and Centered */}
           <div className="w-full flex-1 flex flex-col justify-center items-center text-center">
             <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-4 font-bold">TODAY'S ADVICE</p>
             {/* 수정됨: text-lg -> text-[17px]로 크기 축소 */}
             <p className="text-[17px] font-black serif leading-snug break-keep text-black">
               "{result.advice}"
             </p>
           </div>
        </div>

        {/* Footer */}
        <div className="mt-4 text-[12px] font-bold text-center text-black tracking-tight border-t border-black pt-2 w-full">
          AI융합교육센터 방문을 환영합니다.
        </div>
      </div>

    </div>
  );
};

export default ResultCard;