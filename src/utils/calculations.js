export function calculateBMI(weightKg, heightCm) {
  const weight = Number(weightKg);
  const height = Number(heightCm);

  if (!weight || !height) return null;

  const heightM = height / 100;
  return Number((weight / (heightM * heightM)).toFixed(1));
}

export function getBMICategory(bmi) {
  if (!bmi) return 'Missing data';
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal weight';
  if (bmi < 30) return 'Overweight';
  return 'Obesity';
}

export function getTodayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function sortByDateDesc(items) {
  return [...items].sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function formatNumber(value, decimals = 1) {
  if (value === null || value === undefined || value === '') return '-';
  const number = Number(value);
  if (Number.isNaN(number)) return '-';
  return number.toFixed(decimals);
}
