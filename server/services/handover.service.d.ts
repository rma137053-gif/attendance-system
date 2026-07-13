export declare function createHandoverNote(rosterId: string, authorId: string, content: string, requesterStoreId: string | null): Promise<{
    createdAt: string;
    author: {
        id: string;
        name: string;
    };
    id: string;
    rosterId: string;
    authorId: string;
    content: string;
}>;
export declare function listHandoverNotes(rosterId: string, requesterStoreId: string | null): Promise<{
    createdAt: string;
    author: {
        id: string;
        name: string;
    };
    id: string;
    rosterId: string;
    authorId: string;
    content: string;
}[]>;
