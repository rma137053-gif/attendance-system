interface ListRecordsParams {
    type?: string;
    storeId?: string;
    categoryId?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    keyword?: string;
    page: number;
    pageSize: number;
}
interface CreateRecordParams {
    type: string;
    amount: number;
    categoryId: string;
    storeId: string;
    date: string;
    description?: string;
    paymentMethod?: string;
    referenceType?: string;
    referenceId?: string;
}
interface UpdateRecordParams {
    amount?: number;
    categoryId?: string;
    date?: string;
    description?: string | null;
    paymentMethod?: string | null;
    referenceType?: string | null;
    referenceId?: string | null;
}
export declare function listRecords(params: ListRecordsParams): Promise<{
    items: ({
        store: {
            id: string;
            name: string;
        };
        category: {
            id: string;
            name: string;
            type: string;
            icon: string | null;
        };
        reviewer: {
            id: string;
            name: string;
        } | null;
    } & {
        id: string;
        status: string;
        storeId: string;
        createdAt: Date;
        updatedAt: Date;
        type: string;
        categoryId: string;
        date: Date;
        amount: number;
        description: string | null;
        paymentMethod: string | null;
        reviewerId: string | null;
        reviewNote: string | null;
        reviewedAt: Date | null;
        referenceType: string | null;
        referenceId: string | null;
    })[];
    total: number;
    page: number;
    pageSize: number;
}>;
export declare function getRecord(id: string): Promise<{
    store: {
        id: string;
        name: string;
    };
    category: {
        id: string;
        name: string;
        type: string;
        icon: string | null;
    };
    reviewer: {
        id: string;
        name: string;
    } | null;
} & {
    id: string;
    status: string;
    storeId: string;
    createdAt: Date;
    updatedAt: Date;
    type: string;
    categoryId: string;
    date: Date;
    amount: number;
    description: string | null;
    paymentMethod: string | null;
    reviewerId: string | null;
    reviewNote: string | null;
    reviewedAt: Date | null;
    referenceType: string | null;
    referenceId: string | null;
}>;
export declare function createRecord(params: CreateRecordParams): Promise<{
    store: {
        id: string;
        name: string;
    };
    category: {
        id: string;
        name: string;
        type: string;
        icon: string | null;
    };
} & {
    id: string;
    status: string;
    storeId: string;
    createdAt: Date;
    updatedAt: Date;
    type: string;
    categoryId: string;
    date: Date;
    amount: number;
    description: string | null;
    paymentMethod: string | null;
    reviewerId: string | null;
    reviewNote: string | null;
    reviewedAt: Date | null;
    referenceType: string | null;
    referenceId: string | null;
}>;
export declare function updateRecord(id: string, params: UpdateRecordParams): Promise<{
    store: {
        id: string;
        name: string;
    };
    category: {
        id: string;
        name: string;
        type: string;
        icon: string | null;
    };
    reviewer: {
        id: string;
        name: string;
    } | null;
} & {
    id: string;
    status: string;
    storeId: string;
    createdAt: Date;
    updatedAt: Date;
    type: string;
    categoryId: string;
    date: Date;
    amount: number;
    description: string | null;
    paymentMethod: string | null;
    reviewerId: string | null;
    reviewNote: string | null;
    reviewedAt: Date | null;
    referenceType: string | null;
    referenceId: string | null;
}>;
export declare function deleteRecord(id: string): Promise<{
    id: string;
    status: string;
    storeId: string;
    createdAt: Date;
    updatedAt: Date;
    type: string;
    categoryId: string;
    date: Date;
    amount: number;
    description: string | null;
    paymentMethod: string | null;
    reviewerId: string | null;
    reviewNote: string | null;
    reviewedAt: Date | null;
    referenceType: string | null;
    referenceId: string | null;
}>;
export declare function reviewRecord(id: string, status: string, reviewerId: string, reviewNote?: string): Promise<{
    store: {
        id: string;
        name: string;
    };
    category: {
        id: string;
        name: string;
        type: string;
        icon: string | null;
    };
    reviewer: {
        id: string;
        name: string;
    } | null;
} & {
    id: string;
    status: string;
    storeId: string;
    createdAt: Date;
    updatedAt: Date;
    type: string;
    categoryId: string;
    date: Date;
    amount: number;
    description: string | null;
    paymentMethod: string | null;
    reviewerId: string | null;
    reviewNote: string | null;
    reviewedAt: Date | null;
    referenceType: string | null;
    referenceId: string | null;
}>;
export declare function batchReview(ids: string[], status: string, reviewerId: string, reviewNote?: string): Promise<{
    updatedCount: number;
}>;
export {};
//# sourceMappingURL=record.service.d.ts.map