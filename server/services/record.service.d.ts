interface CreateRecordParams {
    userId: string;
    type: 'CLOCK_IN' | 'CLOCK_OUT';
    photoBuffer?: Buffer;
    photoOriginalName?: string;
    requesterStoreId?: string | null;
}
export declare function createRecord(params: CreateRecordParams): Promise<{
    createdAt: string;
    user: {
        id: string;
        name: string;
        email: string;
    };
    rosterId: string | null;
    lateMinutes: number | null;
    note: string | null;
    duplicate: boolean;
    id: string;
    userId: string;
    type: string;
    photoKey: string | null;
    isAnomalous: boolean;
} | {
    createdAt: string;
    user: {
        id: string;
        name: string;
        email: string;
    };
    id: string;
    userId: string;
    rosterId: string | null;
    type: string;
    photoKey: string | null;
    isAnomalous: boolean;
    lateMinutes: number | null;
    note: string | null;
}>;
interface QueryRecordsParams {
    userId?: string;
    startDate?: string;
    endDate?: string;
    type?: 'CLOCK_IN' | 'CLOCK_OUT';
    anomalous?: boolean;
    page?: number;
    pageSize?: number;
}
export declare function queryRecords(params: QueryRecordsParams, storeId: string | null, _requesterRole?: string): Promise<{
    records: {
        createdAt: string;
        hasPhoto: boolean;
        isAnomalous: boolean;
        user: {
            id: string;
            name: string;
            store: {
                id: string;
                name: string;
            } | null;
            email: string;
        };
        id: string;
        userId: string;
        rosterId: string | null;
        type: string;
        photoKey: string | null;
        lateMinutes: number | null;
        note: string | null;
    }[];
    total: number;
    page: number;
    pageSize: number;
}>;
export declare function getPhotoForRecord(recordId: string, requesterUserId: string, requesterRole: string, requesterStoreId: string | null): Promise<Buffer<ArrayBufferLike>>;
export declare function toggleAnomaly(recordId: string, requesterStoreId: string | null): Promise<{
    createdAt: string;
    hasPhoto: boolean;
    user: {
        id: string;
        name: string;
        store: {
            id: string;
            name: string;
        } | null;
        email: string;
    };
    id: string;
    userId: string;
    rosterId: string | null;
    type: string;
    photoKey: string | null;
    isAnomalous: boolean;
    lateMinutes: number | null;
    note: string | null;
}>;
export {};
