export type JuzMetadata = {
  number: number;
  nameAr: string;
};

export const QURAN_JUZS: JuzMetadata[] = [
  { number: 1, nameAr: "الفاتحة" },
  { number: 2, nameAr: "البقرة" },
  { number: 3, nameAr: "آل عمران" },
  { number: 4, nameAr: "النساء" },
  { number: 5, nameAr: "النساء" },
  { number: 6, nameAr: "المائدة" },
  { number: 7, nameAr: "الأنعام" },
  { number: 8, nameAr: "الأعراف" },
  { number: 9, nameAr: "الأنفال" },
  { number: 10, nameAr: "التوبة" },
  { number: 11, nameAr: "يونس" },
  { number: 12, nameAr: "هود" },
  { number: 13, nameAr: "يوسف" },
  { number: 14, nameAr: "الحجر" },
  { number: 15, nameAr: "الإسراء" },
  { number: 16, nameAr: "الكهف" },
  { number: 17, nameAr: "الأنبياء" },
  { number: 18, nameAr: "المؤمنون" },
  { number: 19, nameAr: "الفرقان" },
  { number: 20, nameAr: "النمل" },
  { number: 21, nameAr: "العنكبوت" },
  { number: 22, nameAr: "الأحزاب" },
  { number: 23, nameAr: "يس" },
  { number: 24, nameAr: "الزمر" },
  { number: 25, nameAr: "فصلت" },
  { number: 26, nameAr: "الأحقاف" },
  { number: 27, nameAr: "الذاريات" },
  { number: 28, nameAr: "المجادلة" },
  { number: 29, nameAr: "الملك" },
  { number: 30, nameAr: "النبأ" },
];

export function getJuzMetadata(juzNumber: number | string | null | undefined): JuzMetadata | undefined {
  if (juzNumber == null) return undefined;
  const num = Number(juzNumber);
  if (isNaN(num)) return undefined;
  return QURAN_JUZS.find((j) => j.number === num);
}

export function getJuzLabel(juzNumber: number | string | null | undefined): string {
  if (juzNumber == null) return "";
  const num = Number(juzNumber);
  if (isNaN(num) || num < 1 || num > 30) return `الجزء ${juzNumber}`;
  const metadata = getJuzMetadata(num);
  if (!metadata) return `الجزء ${num}`;
  return `الجزء ${metadata.number} - ${metadata.nameAr}`;
}
