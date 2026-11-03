const DEFAULT_BUSINESS_INFO = {
  name: '',
  brand: 'Victorex',
  address: '',
  phone: '',
  email: '',
  gst: '',
};

export function getBusinessInfo() {
  try {
    const saved = JSON.parse(localStorage.getItem('vx_biz') || '{}');
    return { ...DEFAULT_BUSINESS_INFO, ...saved };
  } catch {
    return { ...DEFAULT_BUSINESS_INFO };
  }
}
