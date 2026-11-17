// lib/utils/analyticsAggregations.ts

import type { Visit, IpdAdmission, Patient } from "@/lib/providers/types";
import type { DonutSlice } from "@/components/charts/InteractiveDonutChart";
import type { BarGroupData } from "@/components/charts/InteractiveBarChart";

export interface UnifiedEncounter {
  id: string;
  type: "OPD" | "IPD";
  category: string;
  date: string;
  patientId: string;
  patientName: string;
  patientAge?: number | string;
  patientGender?: string;
  patientMobile?: string;
  diagnosis?: string;
  bedOrRoom?: string;
  status?: string;
  paymentMethod?: string;
  billedAmount: number;
  paidAmount: number;
  balanceDue: number;
  rawVisit?: Visit;
  rawAdmission?: IpdAdmission;
}

export interface AnalyticsSummary {
  totalEncounters: number;
  uniquePatientsCount: number;
  totalBilled: number;
  totalCollected: number;
  totalPendingDues: number;
  collectionRate: number;
  
  // Hospital Intelligence KPIs
  arpu: number; // Average Revenue Per Patient
  dailyAverageEncounters: number;
  returningPatientRatio: number; // % of returning patients
  activeInpatientsCount: number;
  averageLengthOfStay: number; // ALOS in days

  // Visual Slices
  financialDonut: DonutSlice[];
  paymentChannelDonut: DonutSlice[];
  billStatusDonut: DonutSlice[];
  categoryDonut: DonutSlice[];
  timelineBars: BarGroupData[];
  
  // Demographics
  demographics: {
    maleCount: number;
    femaleCount: number;
    otherCount: number;
    ageBrackets: {
      pediatric: number; // 0 - 14
      youth: number;     // 15 - 24
      adult: number;     // 25 - 59
      senior: number;    // 60+
      unknown: number;
    };
    topDiagnoses: Array<{ name: string; count: number }>;
  };
  encounters: UnifiedEncounter[];
}

export const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const CATEGORY_COLORS: Record<string, string> = {
  OPD: "#3b82f6",
  IPD: "#10b981",
  Emergency: "#ef4444",
  Daycare: "#06b6d4",
  Dental: "#8b5cf6",
  "Minor Surgery": "#f59e0b",
  Vaccination: "#ec4899",
  Physiotherapy: "#14b8a6",
  Other: "#64748b",
};

export function buildUnifiedEncounters(
  visits: Visit[],
  admissions: IpdAdmission[],
  patMap: Map<string, Patient>
): UnifiedEncounter[] {
  const unified: UnifiedEncounter[] = [];

  // Convert OPD / Category Visits
  visits.forEach((v) => {
    const p = v.patient || patMap.get(v.patientId);
    const rawBilled = Number(v.bill?.totalAmount || 0);
    const paid = Number(v.bill?.paidAmount || 0);
    const due = Number(v.bill?.balanceDue || 0);
    const billed = Math.max(rawBilled, paid + due);
    const cat = v.category || "OPD";
    const payMethod = v.bill?.paymentMethod || (paid > 0 ? "CASH" : "UNPAID");

    unified.push({
      id: String(v.id || ""),
      type: cat.toUpperCase() === "IPD" ? "IPD" : "OPD",
      category: cat,
      date: v.date,
      patientId: v.patientId,
      patientName: p?.name || "Patient",
      patientAge: p?.age,
      patientGender: p?.gender,
      patientMobile: p?.mobile,
      diagnosis: v.diagnosis,
      paymentMethod: payMethod,
      billedAmount: billed,
      paidAmount: paid,
      balanceDue: due,
      rawVisit: v,
    });
  });

  // Convert IPD Admissions
  admissions.forEach((adm) => {
    const p = adm.patient || patMap.get(adm.patientId);
    const rawBilled = Number(adm.cumulativeCharges || 0);
    const paid = Number(adm.totalPaid || adm.advancePaid || 0);
    const due = Number(adm.balanceDue || Math.max(rawBilled - paid, 0));
    const billed = Math.max(rawBilled, paid + due);

    unified.push({
      id: String(adm.id || ""),
      type: "IPD",
      category: "IPD",
      date: adm.admissionDate,
      patientId: adm.patientId,
      patientName: p?.name || "Patient",
      patientAge: p?.age,
      patientGender: p?.gender,
      patientMobile: p?.mobile,
      diagnosis: adm.diagnosis,
      bedOrRoom: adm.bedOrRoom,
      status: adm.status === "ADMITTED" ? "Currently Admitted" : "Discharged",
      paymentMethod: paid > 0 ? "UPI" : "UNPAID",
      billedAmount: billed,
      paidAmount: paid,
      balanceDue: due,
      rawAdmission: adm,
    });
  });

  return unified.sort((a, b) => b.date.localeCompare(a.date));
}

export function aggregateAnalytics(
  encounters: UnifiedEncounter[],
  timelineGranularity: "day" | "month" | "year" = "month",
  selectedTimelineYear: number = new Date().getFullYear(),
  dateRangeDays: number = 30
): AnalyticsSummary {
  let totalBilled = 0;
  let totalCollected = 0;
  let totalPendingDues = 0;

  let cashCollected = 0;
  let upiCollected = 0;
  let otherCollected = 0;

  let fullySettledCount = 0;
  let partiallyPaidCount = 0;
  let completelyUnpaidCount = 0;

  const categoryMap = new Map<string, { count: number; billed: number; collected: number; due: number }>();
  const patientEncounterCounts = new Map<string, number>();

  let maleCount = 0;
  let femaleCount = 0;
  let otherCount = 0;

  const ageBrackets = {
    pediatric: 0,
    youth: 0,
    adult: 0,
    senior: 0,
    unknown: 0,
  };

  const diagnosisCounts = new Map<string, number>();

  let activeInpatientsCount = 0;
  let totalStayDays = 0;
  let stayCount = 0;

  encounters.forEach((e) => {
    totalBilled += e.billedAmount;
    totalCollected += e.paidAmount;
    totalPendingDues += e.balanceDue;

    // Track payment channel
    if (e.paidAmount > 0) {
      const pm = (e.paymentMethod || "").toUpperCase();
      if (pm.includes("UPI") || pm.includes("ONLINE") || pm.includes("QR")) {
        upiCollected += e.paidAmount;
      } else if (pm.includes("CASH")) {
        cashCollected += e.paidAmount;
      } else {
        otherCollected += e.paidAmount;
      }
    }

    if (e.patientId) {
      patientEncounterCounts.set(e.patientId, (patientEncounterCounts.get(e.patientId) || 0) + 1);
    }

    // Bill status categorization
    if (e.billedAmount > 0) {
      if (e.balanceDue <= 0 && e.paidAmount >= e.billedAmount) {
        fullySettledCount++;
      } else if (e.paidAmount > 0 && e.balanceDue > 0) {
        partiallyPaidCount++;
      } else {
        completelyUnpaidCount++;
      }
    } else if (e.paidAmount > 0) {
      fullySettledCount++;
    }

    // Category aggregation
    const cat = e.category || "OPD";
    const existing = categoryMap.get(cat) || { count: 0, billed: 0, collected: 0, due: 0 };
    existing.count += 1;
    existing.billed += e.billedAmount;
    existing.collected += e.paidAmount;
    existing.due += e.balanceDue;
    categoryMap.set(cat, existing);

    // IPD metrics
    if (e.rawAdmission) {
      if (e.rawAdmission.status === "ADMITTED") {
        activeInpatientsCount++;
      }
      const admStart = new Date(e.rawAdmission.admissionDate).getTime();
      const admEnd = e.rawAdmission.dischargeDate
        ? new Date(e.rawAdmission.dischargeDate).getTime()
        : new Date().getTime();
      const days = Math.max(1, Math.ceil((admEnd - admStart) / (1000 * 60 * 60 * 24)));
      totalStayDays += days;
      stayCount++;
    }

    // Demographics - Gender
    const gender = (e.patientGender || "").toLowerCase();
    if (gender === "male") maleCount++;
    else if (gender === "female") femaleCount++;
    else if (gender) otherCount++;

    // Demographics - Age
    const ageNum = typeof e.patientAge === "number" ? e.patientAge : parseInt(String(e.patientAge || ""), 10);
    if (!isNaN(ageNum) && ageNum >= 0) {
      if (ageNum < 15) ageBrackets.pediatric++;
      else if (ageNum <= 24) ageBrackets.youth++;
      else if (ageNum <= 59) ageBrackets.adult++;
      else ageBrackets.senior++;
    } else {
      ageBrackets.unknown++;
    }

    // Diagnosis
    if (e.diagnosis && e.diagnosis.trim()) {
      const dx = e.diagnosis.trim();
      diagnosisCounts.set(dx, (diagnosisCounts.get(dx) || 0) + 1);
    }
  });

  const uniquePatientsCount = patientEncounterCounts.size;
  const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;
  const arpu = uniquePatientsCount > 0 ? Math.round(totalBilled / uniquePatientsCount) : 0;
  const dailyAverageEncounters = Number((encounters.length / Math.max(dateRangeDays, 1)).toFixed(1));

  // Returning patients calculation
  let returningPatientsCount = 0;
  patientEncounterCounts.forEach((count) => {
    if (count > 1) returningPatientsCount++;
  });
  const returningPatientRatio =
    uniquePatientsCount > 0 ? Number(((returningPatientsCount / uniquePatientsCount) * 100).toFixed(1)) : 0;

  const averageLengthOfStay = stayCount > 0 ? Number((totalStayDays / stayCount).toFixed(1)) : 0;

  // 1. Financial Donut Slices (Collected vs Dues)
  const financialDonut: DonutSlice[] = [
    {
      id: "FIN_COLLECTED",
      label: "Collected Earnings",
      value: totalCollected,
      color: "#10b981",
      formattedValue: `₹${totalCollected.toLocaleString("en-IN")}`,
      subText: "Realized hospital revenue",
    },
    {
      id: "FIN_DUES",
      label: "Remaining Dues",
      value: totalPendingDues,
      color: "#f59e0b",
      formattedValue: `₹${totalPendingDues.toLocaleString("en-IN")}`,
      subText: "Uncollected patient balance",
    },
  ];

  // 2. Payment Channel Slices (Cash vs UPI vs Pending Dues)
  const paymentChannelDonut: DonutSlice[] = [];
  if (cashCollected > 0) {
    paymentChannelDonut.push({
      id: "PAYMENT_CASH",
      label: "Cash Payments",
      value: cashCollected,
      color: "#10b981",
      formattedValue: `₹${cashCollected.toLocaleString("en-IN")}`,
      subText: "Physical cash collections",
    });
  }
  if (upiCollected > 0) {
    paymentChannelDonut.push({
      id: "PAYMENT_UPI",
      label: "UPI / Online QR",
      value: upiCollected,
      color: "#3b82f6",
      formattedValue: `₹${upiCollected.toLocaleString("en-IN")}`,
      subText: "Instant digital receipts",
    });
  }
  if (otherCollected > 0) {
    paymentChannelDonut.push({
      id: "PAYMENT_OTHER",
      label: "Card / Transfer",
      value: otherCollected,
      color: "#8b5cf6",
      formattedValue: `₹${otherCollected.toLocaleString("en-IN")}`,
      subText: "Bank & card payments",
    });
  }
  if (totalPendingDues > 0) {
    paymentChannelDonut.push({
      id: "PAYMENT_UNPAID",
      label: "Unpaid Balance",
      value: totalPendingDues,
      color: "#f59e0b",
      formattedValue: `₹${totalPendingDues.toLocaleString("en-IN")}`,
      subText: "Pending recovery",
    });
  }

  // 3. Bill Status Donut Slices
  const billStatusDonut: DonutSlice[] = [
    {
      id: "STATUS_SETTLED",
      label: "Fully Settled",
      value: fullySettledCount,
      color: "#10b981",
      formattedValue: `${fullySettledCount} Bills`,
      subText: "Paid in full (₹0 due)",
    },
    {
      id: "STATUS_PARTIAL",
      label: "Partially Paid",
      value: partiallyPaidCount,
      color: "#3b82f6",
      formattedValue: `${partiallyPaidCount} Bills`,
      subText: "Advance / deposit received",
    },
    {
      id: "STATUS_UNPAID",
      label: "Completely Unpaid",
      value: completelyUnpaidCount,
      color: "#ef4444",
      formattedValue: `${completelyUnpaidCount} Bills`,
      subText: "No payment received yet",
    },
  ];

  // 4. Category Donut Slices
  const categoryDonut: DonutSlice[] = Array.from(categoryMap.entries()).map(
    ([catName, stat]) => ({
      id: `CAT_${catName}`,
      label: catName,
      value: stat.count,
      color: CATEGORY_COLORS[catName] || "#8b5cf6",
      formattedValue: `${stat.count} Visits`,
      subText: `₹${stat.collected.toLocaleString("en-IN")} earned · ₹${stat.due.toLocaleString("en-IN")} due`,
    })
  );

  // 5. Timeline Bar Groups
  const timelineBars: BarGroupData[] = [];

  if (timelineGranularity === "month") {
    // 12 calendar months for selected timeline year
    const monthStats = Array.from({ length: 12 }, (_, i) => ({
      monthIndex: i,
      label: MONTH_NAMES[i],
      collected: 0,
      dues: 0,
      billed: 0,
      count: 0,
    }));

    encounters.forEach((e) => {
      const d = new Date(e.date);
      if (d.getFullYear() === selectedTimelineYear) {
        const m = d.getMonth();
        monthStats[m].collected += e.paidAmount;
        monthStats[m].dues += e.balanceDue;
        monthStats[m].billed += e.billedAmount;
        monthStats[m].count += 1;
      }
    });

    monthStats.forEach((m) => {
      timelineBars.push({
        id: `MONTH_${selectedTimelineYear}_${m.monthIndex}`,
        label: m.label,
        subLabel: `${selectedTimelineYear}`,
        values: {
          collected: m.collected,
          dues: m.dues,
        },
        formattedValues: {
          collected: `₹${m.collected.toLocaleString("en-IN")}`,
          dues: `₹${m.dues.toLocaleString("en-IN")}`,
        },
        metadata: {
          year: selectedTimelineYear,
          month: m.monthIndex,
          encountersCount: m.count,
        },
      });
    });
  } else if (timelineGranularity === "day") {
    // Day-wise aggregation across encounters (grouped by YYYY-MM-DD)
    const dayMap = new Map<string, { collected: number; dues: number; count: number }>();

    encounters.forEach((e) => {
      const dayKey = e.date.slice(0, 10);
      const cur = dayMap.get(dayKey) || { collected: 0, dues: 0, count: 0 };
      cur.collected += e.paidAmount;
      cur.dues += e.balanceDue;
      cur.count += 1;
      dayMap.set(dayKey, cur);
    });

    // Chronological days
    const sortedDays = Array.from(dayMap.keys()).sort();
    sortedDays.forEach((dayKey) => {
      const stat = dayMap.get(dayKey)!;
      const d = new Date(dayKey + "T00:00:00");
      const dayLabel = `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;

      timelineBars.push({
        id: `DAY_${dayKey}`,
        label: dayLabel,
        subLabel: dayKey,
        values: {
          collected: stat.collected,
          dues: stat.dues,
        },
        formattedValues: {
          collected: `₹${stat.collected.toLocaleString("en-IN")}`,
          dues: `₹${stat.dues.toLocaleString("en-IN")}`,
        },
        metadata: {
          dateStr: dayKey,
          encountersCount: stat.count,
        },
      });
    });
  } else if (timelineGranularity === "year") {
    // Multi-year aggregation across encounters
    const yearMap = new Map<number, { collected: number; dues: number; count: number }>();

    encounters.forEach((e) => {
      const yr = new Date(e.date).getFullYear();
      const cur = yearMap.get(yr) || { collected: 0, dues: 0, count: 0 };
      cur.collected += e.paidAmount;
      cur.dues += e.balanceDue;
      cur.count += 1;
      yearMap.set(yr, cur);
    });

    const currentYear = new Date().getFullYear();
    // Guarantee at least the last 3 years appear
    [currentYear - 2, currentYear - 1, currentYear].forEach((yr) => {
      if (!yearMap.has(yr)) {
        yearMap.set(yr, { collected: 0, dues: 0, count: 0 });
      }
    });

    const sortedYears = Array.from(yearMap.keys()).sort((a, b) => a - b);
    sortedYears.forEach((yr) => {
      const stat = yearMap.get(yr)!;
      timelineBars.push({
        id: `YEAR_${yr}`,
        label: `${yr}`,
        subLabel: "Full Year",
        values: {
          collected: stat.collected,
          dues: stat.dues,
        },
        formattedValues: {
          collected: `₹${stat.collected.toLocaleString("en-IN")}`,
          dues: `₹${stat.dues.toLocaleString("en-IN")}`,
        },
        metadata: {
          year: yr,
          encountersCount: stat.count,
        },
      });
    });
  }

  // Top 5 diagnoses
  const topDiagnoses = Array.from(diagnosisCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalEncounters: encounters.length,
    uniquePatientsCount,
    totalBilled,
    totalCollected,
    totalPendingDues,
    collectionRate,
    arpu,
    dailyAverageEncounters,
    returningPatientRatio,
    activeInpatientsCount,
    averageLengthOfStay,
    financialDonut,
    paymentChannelDonut,
    billStatusDonut,
    categoryDonut,
    timelineBars,
    demographics: {
      maleCount,
      femaleCount,
      otherCount,
      ageBrackets,
      topDiagnoses,
    },
    encounters,
  };
}

export function filterEncountersBySlice(
  encounters: UnifiedEncounter[],
  sliceId: string,
  metadata?: any
): UnifiedEncounter[] {
  if (sliceId === "FIN_COLLECTED") {
    return encounters.filter((e) => e.paidAmount > 0);
  }
  if (sliceId === "FIN_DUES") {
    return encounters.filter((e) => e.balanceDue > 0);
  }
  if (sliceId === "PAYMENT_CASH") {
    return encounters.filter(
      (e) => e.paidAmount > 0 && (e.paymentMethod || "").toUpperCase().includes("CASH")
    );
  }
  if (sliceId === "PAYMENT_UPI") {
    return encounters.filter(
      (e) =>
        e.paidAmount > 0 &&
        ((e.paymentMethod || "").toUpperCase().includes("UPI") ||
          (e.paymentMethod || "").toUpperCase().includes("ONLINE"))
    );
  }
  if (sliceId === "PAYMENT_OTHER") {
    return encounters.filter(
      (e) =>
        e.paidAmount > 0 &&
        !(e.paymentMethod || "").toUpperCase().includes("CASH") &&
        !(e.paymentMethod || "").toUpperCase().includes("UPI")
    );
  }
  if (sliceId === "PAYMENT_UNPAID") {
    return encounters.filter((e) => e.balanceDue > 0);
  }
  if (sliceId === "STATUS_SETTLED") {
    return encounters.filter((e) => e.balanceDue <= 0 && e.paidAmount > 0);
  }
  if (sliceId === "STATUS_PARTIAL") {
    return encounters.filter((e) => e.paidAmount > 0 && e.balanceDue > 0);
  }
  if (sliceId === "STATUS_UNPAID") {
    return encounters.filter((e) => e.billedAmount > 0 && e.paidAmount <= 0);
  }
  if (sliceId.startsWith("CAT_")) {
    const targetCat = sliceId.replace("CAT_", "").toLowerCase();
    return encounters.filter(
      (e) => (e.category || "OPD").trim().toLowerCase() === targetCat
    );
  }
  if (sliceId.startsWith("MONTH_") && metadata) {
    const { year, month } = metadata;
    return encounters.filter((e) => {
      const d = new Date(e.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }
  if (sliceId.startsWith("DAY_") && metadata) {
    const { dateStr } = metadata;
    return encounters.filter((e) => e.date.slice(0, 10) === dateStr);
  }
  if (sliceId.startsWith("YEAR_") && metadata) {
    const { year } = metadata;
    return encounters.filter((e) => new Date(e.date).getFullYear() === year);
  }

  return encounters;
}
