interface ReportRow {
    userId: string;
    userName: string;
    userEmail: string;
    storeName: string;
    clockInCount: number;
    clockOutCount: number;
    daysWithRecords: number;
    totalHours: number;
    lateCount: number;
    earlyCount: number;
    missingClockOut: boolean;
}
interface WeeklyReportRow extends ReportRow {
    weekStart: string;
    weekEnd: string;
}
interface MonthlyReportRow extends ReportRow {
    month: string;
}
interface YearlyReportRow extends ReportRow {
    year: string;
}
export declare function getWeeklyReport(storeId: string | null, dateStr?: string): Promise<{
    weekStart: string;
    weekEnd: string;
    userId: string;
    userName: string;
    userEmail: string;
    storeName: string;
    clockInCount: number;
    clockOutCount: number;
    daysWithRecords: number;
    totalHours: number;
    lateCount: number;
    earlyCount: number;
    missingClockOut: boolean;
}[]>;
export declare function getMonthlyReport(storeId: string | null, monthStr?: string): Promise<{
    month: string;
    userId: string;
    userName: string;
    userEmail: string;
    storeName: string;
    clockInCount: number;
    clockOutCount: number;
    daysWithRecords: number;
    totalHours: number;
    lateCount: number;
    earlyCount: number;
    missingClockOut: boolean;
}[]>;
export declare function getYearlyReport(storeId: string | null, yearStr?: string): Promise<{
    year: string;
    userId: string;
    userName: string;
    userEmail: string;
    storeName: string;
    clockInCount: number;
    clockOutCount: number;
    daysWithRecords: number;
    totalHours: number;
    lateCount: number;
    earlyCount: number;
    missingClockOut: boolean;
}[]>;
export declare function generateSummary(rows: ReportRow[]): ReportRow & {
    userName: string;
};
export declare function generateCsv(rows: (WeeklyReportRow | MonthlyReportRow | YearlyReportRow)[]): string;
export {};
