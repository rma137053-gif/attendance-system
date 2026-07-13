interface LoginParams {
    username: string;
    password: string;
}
export declare function login({ username, password }: LoginParams): Promise<{
    token: string;
    expiresIn: string;
    user: {
        id: string;
        username: string;
        name: string;
        role: string;
        storeId: string | null;
        store: {
            id: string;
            name: string;
        } | null;
    };
}>;
export declare function getMe(userId: string): Promise<{
    id: string;
    username: string;
    name: string;
    role: string;
    status: string;
    storeId: string | null;
    store: {
        id: string;
        name: string;
    } | null;
}>;
export declare function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{
    message: string;
}>;
export {};
//# sourceMappingURL=auth.service.d.ts.map