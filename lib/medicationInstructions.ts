export enum MedicationInstruction {
  // Food Related
  BEFORE_MEALS = 'BEFORE_MEALS',
  AFTER_MEALS = 'AFTER_MEALS',
  WITH_FOOD = 'WITH_FOOD',
  EMPTY_STOMACH = 'EMPTY_STOMACH',

  // Fluid Related
  PLENTY_OF_WATER = 'PLENTY_OF_WATER',
  WITH_MILK = 'WITH_MILK',
  AVOID_ALCOHOL = 'AVOID_ALCOHOL',
  DISSOLVE_IN_WATER = 'DISSOLVE_IN_WATER',

  // Administration
  SWALLOW_WHOLE = 'SWALLOW_WHOLE',
  CHEW_WELL = 'CHEW_WELL',
  UNDER_TONGUE = 'UNDER_TONGUE',
  APPLY_LOCALLY = 'APPLY_LOCALLY',
  SHAKE_WELL = 'SHAKE_WELL',

  // Timing
  AT_BEDTIME = 'AT_BEDTIME',
  IN_MORNING = 'IN_MORNING',
  AS_NEEDED_SOS = 'AS_NEEDED_SOS',
  IMMEDIATELY_STAT = 'IMMEDIATELY_STAT',

  // Cautions
  COMPLETE_COURSE = 'COMPLETE_COURSE',
  MAY_CAUSE_DROWSINESS = 'MAY_CAUSE_DROWSINESS',
  AVOID_SUNLIGHT = 'AVOID_SUNLIGHT',
  NONE = 'NONE'
}

export type InstructionLanguage = 'en' | 'hi' | 'mr';

export interface InstructionTranslations {
  en: string;
  hi: string;
  mr: string;
}

export const MedicationInstructionLabels: Record<MedicationInstruction, InstructionTranslations> = {
  [MedicationInstruction.BEFORE_MEALS]: {
    en: 'Take before meals',
    hi: 'खाने से पहले लें',
    mr: 'जेवणापूर्वी घ्या'
  },
  [MedicationInstruction.AFTER_MEALS]: {
    en: 'Take after meals',
    hi: 'खाने के बाद लें',
    mr: 'जेवणानंतर घ्या'
  },
  [MedicationInstruction.WITH_FOOD]: {
    en: 'Take with food',
    hi: 'भोजन के साथ लें',
    mr: 'जेवणासोबत घ्या'
  },
  [MedicationInstruction.EMPTY_STOMACH]: {
    en: 'Take on an empty stomach',
    hi: 'खाली पेट लें',
    mr: 'रिकाम्या पोटी घ्या'
  },
  [MedicationInstruction.PLENTY_OF_WATER]: {
    en: 'Take with plenty of water',
    hi: 'खूब सारे पानी के साथ लें',
    mr: 'भरपूर पाण्यासोबत घ्या'
  },
  [MedicationInstruction.WITH_MILK]: {
    en: 'Take with milk',
    hi: 'दूध के साथ लें',
    mr: 'दुधासोबत घ्या'
  },
  [MedicationInstruction.AVOID_ALCOHOL]: {
    en: 'Strictly avoid alcohol',
    hi: 'शराब का सेवन बिल्कुल न करें',
    mr: 'मद्यपान पूर्णपणे टाळा'
  },
  [MedicationInstruction.DISSOLVE_IN_WATER]: {
    en: 'Dissolve in water before taking',
    hi: 'लेने से पहले पानी में घोल लें',
    mr: 'घेण्यापूर्वी पाण्यात विरघळवा'
  },
  [MedicationInstruction.SWALLOW_WHOLE]: {
    en: 'Swallow whole (Do not crush or chew)',
    hi: 'साबुत निगल लें (चबाएं या कुचलें नहीं)',
    mr: 'पूर्ण गिळा (चावू किंवा चुरा करू नका)'
  },
  [MedicationInstruction.CHEW_WELL]: {
    en: 'Chew tablet well before swallowing',
    hi: 'निगलने से पहले गोली को अच्छी तरह चबाएं',
    mr: 'गिळण्यापूर्वी गोळी चांगली चावा'
  },
  [MedicationInstruction.UNDER_TONGUE]: {
    en: 'Place under the tongue (Sublingual)',
    hi: 'जीभ के नीचे रखें',
    mr: 'जिभेखाली ठेवा'
  },
  [MedicationInstruction.APPLY_LOCALLY]: {
    en: 'Apply to the affected area',
    hi: 'प्रभावित जगह पर लगाएं',
    mr: 'प्रभावित भागावर लावा'
  },
  [MedicationInstruction.SHAKE_WELL]: {
    en: 'Shake well before use',
    hi: 'इस्तेमाल से पहले अच्छी तरह हिलाएं',
    mr: 'वापरण्यापूर्वी चांगले हलवा'
  },
  [MedicationInstruction.AT_BEDTIME]: {
    en: 'Take at bedtime',
    hi: 'सोते समय लें',
    mr: 'झोपताना घ्या'
  },
  [MedicationInstruction.IN_MORNING]: {
    en: 'Take first thing in the morning',
    hi: 'सुबह सबसे पहले लें',
    mr: 'सकाळी सर्वात आधी घ्या'
  },
  [MedicationInstruction.AS_NEEDED_SOS]: {
    en: 'Take only when necessary (SOS)',
    hi: 'जरूरत पड़ने पर ही लें',
    mr: 'फक्त गरज असेल तेव्हाच घ्या'
  },
  [MedicationInstruction.IMMEDIATELY_STAT]: {
    en: 'Take immediately (STAT)',
    hi: 'तुरंत लें',
    mr: 'त्वरित घ्या'
  },
  [MedicationInstruction.COMPLETE_COURSE]: {
    en: 'Complete the full course',
    hi: 'पूरा कोर्स खत्म करें',
    mr: 'पूर्ण कोर्स संपवा'
  },
  [MedicationInstruction.MAY_CAUSE_DROWSINESS]: {
    en: 'May cause drowsiness',
    hi: 'नींद या सुस्ती आ सकती है',
    mr: 'गुंगी येऊ शकते'
  },
  [MedicationInstruction.AVOID_SUNLIGHT]: {
    en: 'Avoid direct sunlight',
    hi: 'सीधी धूप से बचें',
    mr: 'थेट सूर्यप्रकाश टाळा'
  },
  [MedicationInstruction.NONE]: {
    en: 'No specific instructions',
    hi: 'कोई विशेष निर्देश नहीं',
    mr: 'कोणतीही विशिष्ट सूचना नाही'
  }
};

export interface DoseWords {
  en: string;
  hi: string;
  mr: string;
}

export function parseDoseToWords(doseStr: string): DoseWords {
  if (!doseStr || !doseStr.trim()) {
    return { en: '', hi: '', mr: '' };
  }

  const s = doseStr.trim();
  const lower = s.toLowerCase();

  if (lower === 'sos' || lower.includes('needed')) {
    return { en: 'As needed (SOS)', hi: 'ज़रूरत पड़ने पर', mr: 'गरज असल्यास' };
  }
  if (lower === 'stat' || lower.includes('immediately')) {
    return { en: 'Immediately (STAT)', hi: 'तुरंत', mr: 'त्वरित' };
  }
  if (lower.includes('1 per week') || lower.includes('1/week') || lower.includes('once a week')) {
    return { en: '1 per week', hi: 'हफ़्ते में 1 बार', mr: 'आवड्यातून 1 वेळ' };
  }
  if (lower.includes('2 per week') || lower.includes('2/week')) {
    return { en: '2 per week', hi: 'हफ़्ते में 2 बार', mr: 'आवड्यातून 2 वेळा' };
  }
  if (lower.includes('1 per month') || lower.includes('1/month') || lower.includes('once a month')) {
    return { en: '1 per month', hi: 'महीने में 1 बार', mr: 'महिनातून 1 वेळ' };
  }

  const parts = s.split('-').map(p => p.trim());
  if (parts.length === 3) {
    const [m, a, n] = parts;

    const enParts: string[] = [];
    const hiParts: string[] = [];
    const mrParts: string[] = [];

    const formatTime = (timeEn: string, timeHi: string, timeMr: string, qty: string) => {
      if (qty === '1/2' || qty === '0.5') {
        return { en: `1/2 ${timeEn}`, hi: `1/2 ${timeHi}`, mr: `1/2 ${timeMr}` };
      }
      if (qty === '2') {
        return { en: `2 ${timeEn}`, hi: `2 ${timeHi}`, mr: `2 ${timeMr}` };
      }
      if (qty !== '1' && qty !== '0' && qty !== '') {
        return { en: `${qty} ${timeEn}`, hi: `${qty} ${timeHi}`, mr: `${qty} ${timeMr}` };
      }
      return { en: timeEn, hi: timeHi, mr: timeMr };
    };

    if (m !== '0' && m !== '') {
      const t = formatTime('Morning', 'सुबह', 'सकाळी', m);
      enParts.push(t.en);
      hiParts.push(t.hi);
      mrParts.push(t.mr);
    }
    if (a !== '0' && a !== '') {
      const t = formatTime('Afternoon', 'दोपहर', 'दुपारी', a);
      enParts.push(t.en);
      hiParts.push(t.hi);
      mrParts.push(t.mr);
    }
    if (n !== '0' && n !== '') {
      const t = formatTime('Night', 'रात', 'रात्री', n);
      enParts.push(t.en);
      hiParts.push(t.hi);
      mrParts.push(t.mr);
    }

    if (enParts.length > 0) {
      return {
        en: enParts.join(' - '),
        hi: hiParts.join(' - '),
        mr: mrParts.join(' - ')
      };
    }
  }

  return { en: s, hi: s, mr: s };
}

/**
 * Format instructions array or keys into human readable string for chosen languages.
 * Languages default to ['en', 'hi'] if not specified.
 */
export function formatInstructionsText(
  keys: (MedicationInstruction | string)[],
  languages: InstructionLanguage[] = ['en', 'hi'],
  customText?: string
): string {
  const parts: string[] = [];

  for (const k of keys) {
    if (k in MedicationInstructionLabels) {
      const enumKey = k as MedicationInstruction;
      const translations = MedicationInstructionLabels[enumKey];
      if (enumKey === MedicationInstruction.NONE) continue;

      const langTexts = languages
        .map(lang => translations[lang])
        .filter(Boolean);
      
      if (langTexts.length > 0) {
        parts.push(langTexts.join(' / '));
      }
    } else if (typeof k === 'string' && k.trim()) {
      parts.push(k.trim());
    }
  }

  if (customText && customText.trim()) {
    parts.push(customText.trim());
  }

  return parts.join(', ');
}
