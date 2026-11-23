export function isAdvertisingPurchaseService(name: string) {
  const normalized = name.replace(/[أإآ]/g, 'ا').toLowerCase();
  return normalized.includes('شراء اعلان') || normalized.includes('شراء الاعلان');
}
