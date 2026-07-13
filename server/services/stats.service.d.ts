export declare function getTodayStats(storeId: string | null): Promise<{
    date: string;
    totalEmployees: number;
    clockedInCount: number;
    notClockedInCount: number;
    clockedOutCount: number;
    missingClockOutCount: number;
    clockedIn: {
        id: string;
        name: string;
        email: string;
        storeName: string;
        firstIn: string;
        lastOut: string | null;
    }[];
    notClockedIn: {
        id: string;
        name: string;
        email: string;
        storeName: string;
    }[];
    missingClockOut: {
        id: string;
        name: string;
        email: string;
        storeName: string;
    }[];
}>;
