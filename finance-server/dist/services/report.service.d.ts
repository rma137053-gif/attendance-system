interface ReportFilters {
    storeId?: string;
    startDate?: string;
    endDate?: string;
    year?: number;
    type?: string;
}
export declare function getSummary(filters: ReportFilters): Promise<{
    totalIncome: number;
    totalExpense: number;
    netBalance: number;
    incomeCount: number;
    expenseCount: number;
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
    storeBreakdown: {
        storeId: string;
        storeName: string;
        income: number;
        expense: number;
    }[];
}>;
export declare function getMonthlyReport(filters: ReportFilters): Promise<{
    month: string;
    income: number;
    expense: number;
    net: number;
}[]>;
export declare function getCategoryReport(filters: ReportFilters): Promise<{
    categoryId: string;
    categoryName: string;
    categoryIcon: string;
    total: number;
    count: number;
    percentage: number;
}[]>;
export declare function getDailyTrend(filters: ReportFilters): Promise<{
    income: number;
    expense: number;
    date: string;
}[]>;
export declare function exportCSV(filters: ReportFilters): Promise<string>;
export {};
//# sourceMappingURL=report.service.d.ts.map