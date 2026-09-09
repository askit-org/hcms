import { NextResponse } from 'next/server';
import { mockVisits, mockPatients } from '../../mockData';

export async function GET() {
  const today = new Date().toISOString().split('T')[0];
  const patMap = new Map(mockPatients.map((p) => [p.patientId, p]));

  const todayVisits = mockVisits.filter((v) => v.date?.startsWith(today));
  const followUpsTodayList = mockVisits
    .filter((v) => v.followUpDate === today && !v.followUpAttended)
    .map((v) => ({
      visit: v,
      patient: patMap.get(v.patientId),
    }));

  const upcomingFollowUpsList = mockVisits.filter(
    (v) => v.followUpDate && v.followUpDate > today && !v.followUpAttended
  );

  const stats = {
    todayTotal: todayVisits.length,
    todayNew: todayVisits.filter((v) => v.category === 'New' || v.category === 'OPD').length,
    todayReturning: todayVisits.filter((v) => v.category === 'Followup').length,
    totalPatients: mockPatients.length,
    followUpsToday: followUpsTodayList.length,
    upcomingFollowUps: upcomingFollowUpsList.length,
    recentVisits: mockVisits.slice(0, 5).map((v) => ({
      visit: v,
      patient: patMap.get(v.patientId),
    })),
    todayFollowUpList: followUpsTodayList,
  };

  return NextResponse.json(stats);
}
