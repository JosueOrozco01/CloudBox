function isOwnedAvatarPath(userId, value) {
  return typeof userId === 'string' && typeof value === 'string'
    && value.startsWith(userId + '/') && value.split('/').length === 2
    && !/[\\\x00-\x1f]/.test(value) && !value.includes('..');
}
module.exports = { isOwnedAvatarPath };
