const crypto = require('crypto');

const {
    validateStorageProvider
} = require('../contracts/storage-provider.contract');

const supabaseStorageAdapter =
    require('../adapters/storage/supabase-storage.adapter');

const storageProvider =
    validateStorageProvider(supabaseStorageAdapter);

const StorageService = {
    buildFilePath(userId, originalName) {
        const safeName = originalName
            .trim()
            .replace(/\s+/g, '_')
            .replace(/[^a-zA-Z0-9._-]/g, '');

        const uniqueId = crypto.randomUUID();

        return `usuarios/${userId}/${uniqueId}-${safeName}`;
    },

    async uploadFile({
        userId,
        fileName,
        buffer,
        mimeType
    }) {
        const storagePath = this.buildFilePath(
            userId,
            fileName
        );

        return storageProvider.upload({
            storagePath,
            buffer,
            mimeType
        });
    },

    async createSignedUrl(
        storagePath,
        expiresIn = 60
    ) {
        return storageProvider.createSignedUrl(
            storagePath,
            expiresIn
        );
    },

    async deleteFile(storagePath) {
        return storageProvider.deleteFile(
            storagePath
        );
    }
};

module.exports = StorageService;