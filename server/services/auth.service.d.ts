export declare function register(email: string, password: string, name: string, storeId: string): Promise<{
    id: string;
    name: string;
    storeId: string | null;
    email: string;
    role: string;
}>;
export declare function login(email: string, password: string): Promise<{
    token: string;
    user: {
        id: string;
        email: string;
        name: string;
        role: string;
        storeId: string | null;
        storeName: string | null;
    };
}>;
export declare function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;
export declare function getMe(userId: string): Promise<{
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
