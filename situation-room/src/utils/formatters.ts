/**
 * 전화번호 포맷터 (xxx-xxxx-xxxx 또는 xxx-xxx-xxxx)
 */
export const formatPhone = (val: string): string => {
  const clean = val.replace(/[^0-9]/g, '');
  if (clean.length <= 3) return clean;
  if (clean.length <= 7) {
    return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  }
  if (clean.length <= 10) {
    return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6)}`;
  }
  return `${clean.slice(0, 3)}-${clean.slice(3, 7)}-${clean.slice(7, 11)}`;
};

/**
 * 사업자 등록 번호 포멧 (xxx-xx-xxxxx)
 */
export const formatBizNo = (val: string): string => {
  const clean = val.replace(/[^0-9]/g, '');
  if (clean.length <= 3) return clean;
  if (clean.length <= 5) {
    return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  }
  return `${clean.slice(0, 3)}-${clean.slice(3, 5)}-${clean.slice(5, 10)}`;
};

/**
 * 주민등록 번호 포멧 (xxxxxx-xxxxxxx)
 */
export const formatJuminNo = (val: string): string => {
  const clean = val.replace(/[^0-9]/g, '');
  if (clean.length <= 6) return clean;
  return `${clean.slice(0, 6)}-${clean.slice(6, 13)}`;
};
