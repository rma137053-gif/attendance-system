export declare function listStores(): Promise<{
    id: string;
    createdAt: Date;
    name: string;
}[]>;
export declare function listEmployeeRoster(storeId: string | null): Promise<{
    startTime: string | null;
    endTime: string | null;
    id: string;
    name: string;
    role: string;
}[]>;
export declare function listEmployees(storeId: string | null): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    name: string;
    storeId: string | null;
    store: {
        id: string;
        name: string;
    } | null;
    email: string;
    role: string;
    pin: string | null;
}[]>;
export declare function createEmployee(email: string, password: string, name: string, storeId: string, pin?: string): Promise<{
    id: string;
    status: string;
    name: string;
    storeId: string | null;
    store: {
        id: string;
        name: string;
    } | null;
    email: string;
    role: string;
}>;
export declare function verifyPin(userId: string, pin: string, storeId: string | null): Promise<{
    id: string;
    name: string;
}>;
export declare function updateEmployee(id: string, data: {
    name?: string;
    email?: string;
    pin?: string;
}, storeId: string | null): Promise<{
    id: string;
    status: string;
    name: string;
    storeId: string | null;
    store: {
        id: string;
        name: string;
    } | null;
    email: string;
    role: string;
    pin: string | null;
}>;
export declare function toggleEmployeeStatus(id: string, storeId: string | null): Promise<{
    id: string;
    status: string;
    name: string;
    storeId: string | null;
    store: {
        id: string;
        name: string;
    } | null;
    email: string;
    role: string;
}>;
export declare function resetPassword(id: string, newPassword: string, storeId: string | null): Promise<void>;
