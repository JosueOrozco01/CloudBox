export const notifyStorageUpdated = () => {
  window.dispatchEvent(
    new Event("cloudbox:storage-updated")
  );
};