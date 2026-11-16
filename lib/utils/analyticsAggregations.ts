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
  financialDonut: DonutSlice[];
  billStatusDonut: DonutSlice[];
  categoryDonut: DonutSlice[];
  timelineBars: BarGroupData[];
  demographics: {
    maleCount: number;
    femaleCount: number;
    otherCount: number;
    topDiagnoses: Array<{ name: string; count: number }>;
  };
  encounters: UnifiedEncounter[];
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const CATEGORY_COLORS: Record<string, string> = {
  OPD: "#3b82f6",
  IPD: "#10b981",
  Emergency: "#f59e0b",
  Dental: "#06b6d4",
  "Minor Surgery": "#8b5cf6",
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
    const billed = Number(v.bill?.totalAmount || 0);
    const paid = Number(v.bill?.paidAmount || 0);
    const due = Number(v.bill?.balanceDue || 0);
    const cat = v.category || "OPD";

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
      billedAmount: billed,
      paidAmount: paid,
      balanceDue: due,
      rawVisit: v,
    });
  });

  // Convert IPD Admissions
  admissions.forEach((adm) => {
    const p = adm.patient || patMap.get(adm.patientId);
    const billed = Number(adm.cumulativeCharges || 0);
    const paid = Number(adm.totalPaid || adm.advancePaid || 0);
    const due = Number(adm.balanceDue || Math.max(billed - paid, 0));

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
  granularity: "day" | "month" | "year" = "month",
  selectedYear: number = new Date().getFullYear()
): AnalyticsSummary {
  let totalBilled = 0;
  let totalCollected = 0;
  let totalPendingDues = 0;

  let fullySettledCount = 0;
  let partiallyPaidCount = 0;
  let completelyUnpaidCount = 0;

  const categoryMap = new Map<string, { count: number; billed: number; collected: number; due: number }>();
  const uniquePatientIds = new Set<string>();

  let maleCount = 0;
  let femaleCount = 0;
  let otherCount = 0;
  const diagnosisCounts = new Map<string, number>();

  encounters.forEach((e) => {
    totalBilled += e.billedAmount;
    totalCollected += e.paidAmount;
    totalPendingDues += e.balanceDue;

    if (e.patientId) uniquePatientIds.add(e.patientId);

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

    // Demographics
    const gender = (e.patientGender || "").toLowerCase();
    if (gender === "male") maleCount++;
    else if (gender === "female") femaleCount++;
    else if (gender) otherCount++;

    if (e.diagnosis && e.diagnosis.trim()) {
      const dx = e.diagnosis.trim();
      diagnosisCounts.set(dx, (diagnosisCounts.get(dx) || 0) + 1);
    }
  });

  const collectionRate =
    totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

  // 1. Financial Donut Slices
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

  // 2. Bill Status Donut Slices
  const billStatusDonut: DonutSlice[] = [
    {
      id: "STATUS_SETTLED",
      label: "Fully Settled",
      value: fullySettledCount,
      color: "#10b981",
      formattedValue: `${fullySettledCount} Bills`,
      subText: "Paid in full",
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

  // 3. Category Donut Slices
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

  // 4. Timeline Bar Groups
  const timelineBars: BarGroupData[] = [];

  if (granularity === "month") {
    // 12 calendar months for the selected year
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
      if (d.getFullYear() === selectedYear) {
        const m = d.getMonth();
        monthStats[m].collected += e.paidAmount;
        monthStats[m].dues += e.balanceDue;
        monthStats[m].billed += e.billedAmount;
        monthStats[m].count += 1;
      }
    });

    monthStats.forEach((m) => {
      timelineBars.push({
        id: `MONTH_${selectedYear}_${m.monthIndex}`,
        label: m.label,
        subLabel: `${selectedYear}`,
        values: {
          collected: m.collected,
          dues: m.dues,
        },
        formattedValues: {
          collected: `₹${m.collected.toLocaleString("en-IN")}`,
          dues: `₹${m.dues.toLocaleString("en-IN")}`,
        },
        metadata: {
          year: selectedYear,
          month: m.monthIndex,
          encountersCount: m.count,
        },
      });
    });
  } else if (granularity === "day") {
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

    // Sort by chronological day
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
  } else if (granularity === "year") {
    // Yearly aggregation across encounters
    const yearMap = new Map<number, { collected: number; dues: number; count: number }>();

    encounters.forEach((e) => {
      const yr = new Date(e.date).getFullYear();
      const cur = yearMap.get(yr) || { collected: 0, dues: 0, count: 0 };
      cur.collected += e.paidAmount;
      cur.dues += e.balanceDue;
      cur.count += 1;
      yearMap.set(yr, cur);
    });

    const sortedYears = Array.from(yearMap.keys()).sort();
    sortedYears.forEach((yr) => {
      const stat = yearMap.get(yr)!;
      timelineBars.push({
        id: `YEAR_${yr}`,
        label: `${yr}`,
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
    uniquePatientsCount: uniquePatientIds.size,
    totalBilled,
    totalCollected,
    totalPendingDues,
    collectionRate,
    financialDonut,
    billStatusDonut,
    categoryDonut,
    timelineBars,
    demographics: {
      maleCount,
      femaleCount,
      otherCount,
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
