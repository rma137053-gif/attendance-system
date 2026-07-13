interface BatchAssignment {
    userId: string;
    shiftDate: string;
    startTime: string;
    endTime: string;
    breakMinutes?: number;
}
export declare function batchUpsertRoster(storeId: string, assignments: BatchAssignment[], requesterStoreId: string | null): Promise<{
    created: number;
    updated: number;
}>;
interface QueryRosterParams {
    storeId?: string;
    startDate?: string;
    endDate?: string;
    userId?: string;
    requesterUserId?: string;
    requesterRole?: string;
}
export declare function queryRoster(params: QueryRosterParams, requesterStoreId: string | null): Promise<{
    shiftDate: string;
    overtimeMinutes: number;
    user: {
        id: string;
        name: string;
        email: string;
    };
    store: {
        id: string;
        name: string;
    };
    id: string;
    userId: string;
    createdAt: Date;
    storeId: string;
    startTime: string;
    endTime: string;
    breakMinutes: number;
    updatedAt: Date;
}[]>;
export declare function getTodayRoster(userId: string, requesterStoreId: string | null, role?: string): Promise<{
    myShift: null;
    overview: {
        id: string;
        startTime: string;
        endTime: string;
        user: {
            id: string;
            name: string;
        };
        store: {
            id: string;
            name: string;
        };
    }[];
    colleagues?: undefined;
    handoverFrom?: undefined;
    handoverTo?: undefined;
    handoverNotes?: undefined;
} | {
    myShift: null;
    colleagues: never[];
    handoverFrom: null;
    handoverTo: null;
    handoverNotes: never[];
    overview?: undefined;
} | {
    myShift: {
        id: string;
        startTime: string;
        endTime: string;
        shiftDate: string;
        user: {
            id: string;
            name: string;
            email: string;
        };
    };
    colleagues: {
        id: string;
        name: string;
        startTime: string;
        endTime: string;
    }[];
    handoverFrom: {
        id: string;
        user: {
            id: string;
            name: string;
        };
        startTime: string;
        endTime: string;
    }[] | null;
    handoverTo: {
        id: string;
        user: {
            id: string;
            name: string;
        };
        startTime: string;
        endTime: string;
    }[] | null;
    handoverNotes: {
        id: string;
        content: string;
        author: {
            id: string;
            name: string;
        };
        createdAt: string;
    }[];
    overview?: undefined;
}>;
export declare function deleteRoster(rosterId: string, requesterStoreId: string | null): Promise<void>;
export {};
