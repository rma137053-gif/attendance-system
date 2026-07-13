interface CreateCategoryParams {
    name: string;
    type: string;
    icon?: string;
    storeId?: string | null;
    sortOrder?: number;
}
interface UpdateCategoryParams {
    name?: string;
    icon?: string | null;
    sortOrder?: number;
}
export declare function listCategories(type?: string, storeId?: string | null): Promise<{
    id: string;
    name: string;
    storeId: string | null;
    createdAt: Date;
    updatedAt: Date;
    type: string;
    icon: string | null;
    sortOrder: number;
    isSystem: boolean;
}[]>;
export declare function createCategory(params: CreateCategoryParams): Promise<{
    id: string;
    name: string;
    storeId: string | null;
    createdAt: Date;
    updatedAt: Date;
    type: string;
    icon: string | null;
    sortOrder: number;
    isSystem: boolean;
}>;
export declare function updateCategory(id: string, params: UpdateCategoryParams): Promise<{
    id: string;
    name: string;
    storeId: string | null;
    createdAt: Date;
    updatedAt: Date;
    type: string;
    icon: string | null;
    sortOrder: number;
    isSystem: boolean;
}>;
export declare function deleteCategory(id: string): Promise<{
    id: string;
    name: string;
    storeId: string | null;
    createdAt: Date;
    updatedAt: Date;
    type: string;
    icon: string | null;
    sortOrder: number;
    isSystem: boolean;
}>;
export {};
//# sourceMappingURL=category.service.d.ts.map