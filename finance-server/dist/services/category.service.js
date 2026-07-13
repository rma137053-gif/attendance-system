"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCategories = listCategories;
exports.createCategory = createCategory;
exports.updateCategory = updateCategory;
exports.deleteCategory = deleteCategory;
const client_1 = require("@prisma/client");
const errors_1 = require("../utils/errors");
const prisma = new client_1.PrismaClient();
async function listCategories(type, storeId) {
    const where = {};
    if (type)
        where.type = type;
    // If storeId is provided, show shared (null) + store-specific
    if (storeId) {
        where.OR = [{ storeId: null }, { storeId }];
    }
    // For admin (storeId=null), show all
    return prisma.financeCategory.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
}
async function createCategory(params) {
    if (!['INCOME', 'EXPENSE'].includes(params.type)) {
        throw new errors_1.BadRequestError('类型必须为 INCOME 或 EXPENSE');
    }
    return prisma.financeCategory.create({
        data: {
            name: params.name,
            type: params.type,
            icon: params.icon || null,
            storeId: params.storeId || null,
            sortOrder: params.sortOrder || 0,
            isSystem: false,
        },
    });
}
async function updateCategory(id, params) {
    const cat = await prisma.financeCategory.findUnique({ where: { id } });
    if (!cat)
        throw new errors_1.NotFoundError('分类不存在');
    if (cat.isSystem)
        throw new errors_1.BadRequestError('系统预设分类不可修改');
    return prisma.financeCategory.update({
        where: { id },
        data: {
            ...(params.name !== undefined && { name: params.name }),
            ...(params.icon !== undefined && { icon: params.icon }),
            ...(params.sortOrder !== undefined && { sortOrder: params.sortOrder }),
        },
    });
}
async function deleteCategory(id) {
    const cat = await prisma.financeCategory.findUnique({ where: { id } });
    if (!cat)
        throw new errors_1.NotFoundError('分类不存在');
    if (cat.isSystem)
        throw new errors_1.BadRequestError('系统预设分类不可删除');
    // Check if category has records
    const count = await prisma.financeRecord.count({ where: { categoryId: id } });
    if (count > 0)
        throw new errors_1.BadRequestError('该分类下已有收支记录，不可删除');
    return prisma.financeCategory.delete({ where: { id } });
}
//# sourceMappingURL=category.service.js.map