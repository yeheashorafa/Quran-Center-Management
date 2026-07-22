export type QuranSurah = {
  number: number;
  nameAr: string;
  totalAyahs: number;
  startPage: number;
  endPage: number;
};

export const QURAN_SURAHS: QuranSurah[] = [
  { number: 1, nameAr: "الفاتحة", totalAyahs: 7, startPage: 1, endPage: 1 },
  { number: 2, nameAr: "البقرة", totalAyahs: 286, startPage: 2, endPage: 49 },
  { number: 3, nameAr: "آل عمران", totalAyahs: 200, startPage: 50, endPage: 76 },
  { number: 4, nameAr: "النساء", totalAyahs: 176, startPage: 77, endPage: 106 },
  { number: 5, nameAr: "المائدة", totalAyahs: 120, startPage: 106, endPage: 127 },
  { number: 6, nameAr: "الأنعام", totalAyahs: 165, startPage: 128, endPage: 150 },
  { number: 7, nameAr: "الأعراف", totalAyahs: 206, startPage: 151, endPage: 176 },
  { number: 8, nameAr: "الأنفال", totalAyahs: 75, startPage: 177, endPage: 186 },
  { number: 9, nameAr: "التوبة", totalAyahs: 129, startPage: 187, endPage: 207 },
  { number: 10, nameAr: "يونس", totalAyahs: 109, startPage: 208, endPage: 221 },
  { number: 11, nameAr: "هود", totalAyahs: 123, startPage: 221, endPage: 235 },
  { number: 12, nameAr: "يوسف", totalAyahs: 111, startPage: 235, endPage: 248 },
  { number: 13, nameAr: "الرعد", totalAyahs: 43, startPage: 249, endPage: 255 },
  { number: 14, nameAr: "إبراهيم", totalAyahs: 52, startPage: 255, endPage: 261 },
  { number: 15, nameAr: "الحجر", totalAyahs: 99, startPage: 262, endPage: 267 },
  { number: 16, nameAr: "النحل", totalAyahs: 128, startPage: 267, endPage: 281 },
  { number: 17, nameAr: "الإسراء", totalAyahs: 111, startPage: 282, endPage: 293 },
  { number: 18, nameAr: "الكهف", totalAyahs: 110, startPage: 293, endPage: 304 },
  { number: 19, nameAr: "مريم", totalAyahs: 98, startPage: 305, endPage: 312 },
  { number: 20, nameAr: "طه", totalAyahs: 135, startPage: 312, endPage: 321 },
  { number: 21, nameAr: "الأنبياء", totalAyahs: 112, startPage: 322, endPage: 331 },
  { number: 22, nameAr: "الحج", totalAyahs: 78, startPage: 332, endPage: 341 },
  { number: 23, nameAr: "المؤمنون", totalAyahs: 118, startPage: 342, endPage: 349 },
  { number: 24, nameAr: "النور", totalAyahs: 64, startPage: 350, endPage: 359 },
  { number: 25, nameAr: "الفرقان", totalAyahs: 77, startPage: 359, endPage: 366 },
  { number: 26, nameAr: "الشعراء", totalAyahs: 227, startPage: 367, endPage: 376 },
  { number: 27, nameAr: "النمل", totalAyahs: 93, startPage: 377, endPage: 385 },
  { number: 28, nameAr: "القصص", totalAyahs: 88, startPage: 385, endPage: 396 },
  { number: 29, nameAr: "العنكبوت", totalAyahs: 69, startPage: 396, endPage: 404 },
  { number: 30, nameAr: "الروم", totalAyahs: 60, startPage: 404, endPage: 410 },
  { number: 31, nameAr: "لقمان", totalAyahs: 34, startPage: 411, endPage: 414 },
  { number: 32, nameAr: "السجدة", totalAyahs: 30, startPage: 415, endPage: 417 },
  { number: 33, nameAr: "الأحزاب", totalAyahs: 73, startPage: 418, endPage: 427 },
  { number: 34, nameAr: "سبأ", totalAyahs: 54, startPage: 428, endPage: 434 },
  { number: 35, nameAr: "فاطر", totalAyahs: 45, startPage: 434, endPage: 440 },
  { number: 36, nameAr: "يس", totalAyahs: 83, startPage: 440, endPage: 445 },
  { number: 37, nameAr: "الصافات", totalAyahs: 182, startPage: 446, endPage: 452 },
  { number: 38, nameAr: "ص", totalAyahs: 88, startPage: 453, endPage: 458 },
  { number: 39, nameAr: "الزمر", totalAyahs: 75, startPage: 458, endPage: 467 },
  { number: 40, nameAr: "غافر", totalAyahs: 85, startPage: 467, endPage: 476 },
  { number: 41, nameAr: "فصلت", totalAyahs: 54, startPage: 477, endPage: 482 },
  { number: 42, nameAr: "الشورى", totalAyahs: 53, startPage: 483, endPage: 489 },
  { number: 43, nameAr: "الزخرف", totalAyahs: 89, startPage: 489, endPage: 495 },
  { number: 44, nameAr: "الدخان", totalAyahs: 59, startPage: 496, endPage: 498 },
  { number: 45, nameAr: "الجاثية", totalAyahs: 37, startPage: 499, endPage: 502 },
  { number: 46, nameAr: "الأحقاف", totalAyahs: 35, startPage: 502, endPage: 506 },
  { number: 47, nameAr: "محمد", totalAyahs: 38, startPage: 507, endPage: 510 },
  { number: 48, nameAr: "الفتح", totalAyahs: 29, startPage: 511, endPage: 515 },
  { number: 49, nameAr: "الحجرات", totalAyahs: 18, startPage: 515, endPage: 517 },
  { number: 50, nameAr: "ق", totalAyahs: 45, startPage: 518, endPage: 520 },
  { number: 51, nameAr: "الذاريات", totalAyahs: 60, startPage: 520, endPage: 523 },
  { number: 52, nameAr: "الطور", totalAyahs: 49, startPage: 523, endPage: 525 },
  { number: 53, nameAr: "النجم", totalAyahs: 62, startPage: 526, endPage: 528 },
  { number: 54, nameAr: "القمر", totalAyahs: 55, startPage: 528, endPage: 531 },
  { number: 55, nameAr: "الرحمن", totalAyahs: 78, startPage: 531, endPage: 534 },
  { number: 56, nameAr: "الواقعة", totalAyahs: 96, startPage: 534, endPage: 537 },
  { number: 57, nameAr: "الحديد", totalAyahs: 29, startPage: 537, endPage: 541 },
  { number: 58, nameAr: "المجادلة", totalAyahs: 22, startPage: 542, endPage: 545 },
  { number: 59, nameAr: "الحشر", totalAyahs: 24, startPage: 545, endPage: 548 },
  { number: 60, nameAr: "الممتحنة", totalAyahs: 13, startPage: 549, endPage: 551 },
  { number: 61, nameAr: "الصف", totalAyahs: 14, startPage: 551, endPage: 553 },
  { number: 62, nameAr: "الجمعة", totalAyahs: 11, startPage: 553, endPage: 554 },
  { number: 63, nameAr: "المنافقون", totalAyahs: 11, startPage: 554, endPage: 555 },
  { number: 64, nameAr: "التغابن", totalAyahs: 18, startPage: 556, endPage: 558 },
  { number: 65, nameAr: "الطلاق", totalAyahs: 12, startPage: 558, endPage: 560 },
  { number: 66, nameAr: "التحريم", totalAyahs: 12, startPage: 560, endPage: 561 },
  { number: 67, nameAr: "الملك", totalAyahs: 30, startPage: 562, endPage: 564 },
  { number: 68, nameAr: "القلم", totalAyahs: 52, startPage: 564, endPage: 566 },
  { number: 69, nameAr: "الحاقة", totalAyahs: 52, startPage: 566, endPage: 568 },
  { number: 70, nameAr: "المعارج", totalAyahs: 44, startPage: 568, endPage: 570 },
  { number: 71, nameAr: "نوح", totalAyahs: 28, startPage: 570, endPage: 571 },
  { number: 72, nameAr: "الجن", totalAyahs: 28, startPage: 572, endPage: 573 },
  { number: 73, nameAr: "المزمل", totalAyahs: 20, startPage: 574, endPage: 575 },
  { number: 74, nameAr: "المدثر", totalAyahs: 56, startPage: 575, endPage: 577 },
  { number: 75, nameAr: "القيامة", totalAyahs: 40, startPage: 577, endPage: 578 },
  { number: 76, nameAr: "الإنسان", totalAyahs: 31, startPage: 578, endPage: 580 },
  { number: 77, nameAr: "المرسلات", totalAyahs: 50, startPage: 580, endPage: 581 },
  { number: 78, nameAr: "النبأ", totalAyahs: 40, startPage: 582, endPage: 583 },
  { number: 79, nameAr: "النازعات", totalAyahs: 46, startPage: 583, endPage: 584 },
  { number: 80, nameAr: "عبس", totalAyahs: 42, startPage: 585, endPage: 586 },
  { number: 81, nameAr: "التكوير", totalAyahs: 29, startPage: 586, endPage: 586 },
  { number: 82, nameAr: "الانفطار", totalAyahs: 19, startPage: 587, endPage: 587 },
  { number: 83, nameAr: "المطففين", totalAyahs: 36, startPage: 587, endPage: 589 },
  { number: 84, nameAr: "الانشقاق", totalAyahs: 25, startPage: 589, endPage: 590 },
  { number: 85, nameAr: "البروج", totalAyahs: 22, startPage: 590, endPage: 590 },
  { number: 86, nameAr: "الطارق", totalAyahs: 17, startPage: 591, endPage: 591 },
  { number: 87, nameAr: "الأعلى", totalAyahs: 19, startPage: 591, endPage: 592 },
  { number: 88, nameAr: "الغاشية", totalAyahs: 26, startPage: 592, endPage: 593 },
  { number: 89, nameAr: "الفجر", totalAyahs: 30, startPage: 593, endPage: 594 },
  { number: 90, nameAr: "البلد", totalAyahs: 20, startPage: 594, endPage: 595 },
  { number: 91, nameAr: "الشمس", totalAyahs: 15, startPage: 595, endPage: 595 },
  { number: 92, nameAr: "الليل", totalAyahs: 21, startPage: 595, endPage: 596 },
  { number: 93, nameAr: "الضحى", totalAyahs: 11, startPage: 596, endPage: 596 },
  { number: 94, nameAr: "الشرح", totalAyahs: 8, startPage: 596, endPage: 596 },
  { number: 95, nameAr: "التين", totalAyahs: 8, startPage: 597, endPage: 597 },
  { number: 96, nameAr: "العلق", totalAyahs: 19, startPage: 597, endPage: 597 },
  { number: 97, nameAr: "القدر", totalAyahs: 5, startPage: 598, endPage: 598 },
  { number: 98, nameAr: "البينة", totalAyahs: 8, startPage: 598, endPage: 599 },
  { number: 99, nameAr: "الزلزلة", totalAyahs: 8, startPage: 599, endPage: 599 },
  { number: 100, nameAr: "العاديات", totalAyahs: 11, startPage: 599, endPage: 600 },
  { number: 101, nameAr: "القارعة", totalAyahs: 11, startPage: 600, endPage: 600 },
  { number: 102, nameAr: "التكاثر", totalAyahs: 8, startPage: 600, endPage: 600 },
  { number: 103, nameAr: "العصر", totalAyahs: 3, startPage: 601, endPage: 601 },
  { number: 104, nameAr: "الهمزة", totalAyahs: 9, startPage: 601, endPage: 601 },
  { number: 105, nameAr: "الفيل", totalAyahs: 5, startPage: 601, endPage: 601 },
  { number: 106, nameAr: "قريش", totalAyahs: 4, startPage: 602, endPage: 602 },
  { number: 107, nameAr: "الماعون", totalAyahs: 7, startPage: 602, endPage: 602 },
  { number: 108, nameAr: "الكوثر", totalAyahs: 3, startPage: 602, endPage: 602 },
  { number: 109, nameAr: "الكافرون", totalAyahs: 6, startPage: 603, endPage: 603 },
  { number: 110, nameAr: "النصر", totalAyahs: 3, startPage: 603, endPage: 603 },
  { number: 111, nameAr: "المسد", totalAyahs: 5, startPage: 603, endPage: 603 },
  { number: 112, nameAr: "الإخلاص", totalAyahs: 4, startPage: 604, endPage: 604 },
  { number: 113, nameAr: "الفلق", totalAyahs: 5, startPage: 604, endPage: 604 },
  { number: 114, nameAr: "الناس", totalAyahs: 6, startPage: 604, endPage: 604 },
];

export function getSurahByName(name: string): QuranSurah | undefined {
  const cleanName = name.replace(/^سورة\s+/, "").trim();
  return QURAN_SURAHS.find((s) => s.nameAr === cleanName || s.nameAr.includes(cleanName));
}

export function getSurahByNumber(num: number): QuranSurah | undefined {
  return QURAN_SURAHS.find((s) => s.number === num);
}

/**
 * Calculates page count rounded cleanly to integer / decimal for Medina Mushaf
 */
export function calculateAyahPageCount(surahNumber: number, fromAyah: number, toAyah: number): number {
  const surah = getSurahByNumber(surahNumber);
  if (!surah) return 1;

  const validFrom = Math.max(1, Math.min(fromAyah, surah.totalAyahs));
  const validTo = Math.max(validFrom, Math.min(toAyah, surah.totalAyahs));
  const ayahSpan = validTo - validFrom + 1;

  if (validFrom === 1 && validTo === surah.totalAyahs) {
    return surah.endPage - surah.startPage + 1;
  }

  const surahPages = surah.endPage - surah.startPage + 1;
  const rawRatio = (ayahSpan / surah.totalAyahs) * surahPages;
  return Math.max(1, Math.round(rawRatio));
}
