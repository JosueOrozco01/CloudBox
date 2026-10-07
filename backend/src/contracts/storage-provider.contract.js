const REQUIRED_METHODS = [
    'upload',
    'createSignedUrl',
    'deleteFile'
];

function validateStorageProvider(provider) {
    if (!provider) {
        throw new Error(
            'Storage provider is required'
        );
    }

    for (const method of REQUIRED_METHODS) {
        if (typeof provider[method] !== 'function') {
            throw new Error(
                `Storage provider must implement ${method}()`
            );
        }
    }

    return provider;
}

module.exports = {
    validateStorageProvider
};
