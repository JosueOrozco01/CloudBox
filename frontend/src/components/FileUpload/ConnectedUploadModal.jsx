import { useRef, useState } from "react";
import UploadModal from "./UploadModal";
import { uploadDashboardFile } from "../../services/dashboardService";

export default function ConnectedUploadModal({
  storage,
  onClose,
  onUploaded,
  onUploadResult,
  onViewPlans,
  folderId = null,
}) {
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState([]);
  const [uploading, setUploading] = useState(false);
  const lock = useRef(false);
  const completedBytes = files
    .filter((file) => file.status === "completed")
    .reduce((sum, file) => sum + file.raw.size, 0);
  const usedGB = (storage?.usedGB || 0) + completedBytes / 1024 ** 3;
  const currentStorage = { usedGB, totalGB: storage?.totalGB || 0 };
  const update = (id, patch) =>
    setFiles((previous) =>
      previous.map((file) => (file.id === id ? { ...file, ...patch } : file)),
    );
  const selectFiles = (selected) => {
    if (lock.current) return;
    const accepted = [];
    const rejected = [];
    for (const raw of selected) {
      const id = `${raw.name}-${raw.size}-${raw.lastModified}`;
      if (!/\.(pdf|docx|txt|png|jpe?g|zip)$/i.test(raw.name))
        rejected.push({
          id,
          type: "invalid_type",
          message: `${raw.name}: tipo de archivo no permitido.`,
        });
      else if (raw.size > 25 * 1024 ** 2)
        rejected.push({
          id,
          type: "invalid_type",
          message: `${raw.name}: supera el límite de 25 MB.`,
        });
      else if (
        !files.some((file) => file.id === id) &&
        !accepted.some((file) => file.id === id)
      )
        accepted.push({
          id,
          raw,
          name: raw.name,
          sizeMB: Number((raw.size / 1024 ** 2).toFixed(2)),
          status: "waiting",
          progress: 0,
        });
    }
    setFiles((previous) => [...previous, ...accepted]);
    setErrors((previous) => [...previous, ...rejected]);
  };
  const upload = async (
    batch = files.filter(
      (file) => file.status === "waiting" || file.status === "error",
    ),
  ) => {
    if (lock.current || batch.length === 0) return;
    lock.current = true;
    setUploading(true);
    let remaining = Math.max(0, currentStorage.totalGB - usedGB) * 1024 ** 3;
    let completed = 0;
    try {
      for (const file of batch) {
        setErrors((previous) =>
          previous.filter((error) => error.id !== file.id),
        );
        if (!storage || file.raw.size > remaining) {
          update(file.id, { status: "error" });
          setErrors((previous) => [
            ...previous,
            {
              id: file.id,
              type: "exceeds_storage",
              message: `${file.name}: supera el espacio disponible de tu plan.`,
            },
          ]);
          continue;
        }
        update(file.id, { status: "uploading", progress: 0 });
        try {
          await uploadDashboardFile(
            file.raw,
            (progress) => update(file.id, { progress }),
            folderId,
          );
          update(file.id, { status: "completed", progress: 100 });
          remaining -= file.raw.size;
          completed += 1;
        } catch (error) {
          update(file.id, { status: "error" });
          setErrors((previous) => [
            ...previous,
            {
              id: file.id,
              type: "upload_failed",
              message: `${file.name}: ${error.message}`,
            },
          ]);
        }
      }
    } finally {
      lock.current = false;
      setUploading(false);
      if (completed) onUploaded?.();
      onUploadResult?.({ completed, failed: batch.length - completed });
    }
  };
  const close = () => {
    if (!lock.current) onClose();
  };
  return (
    <UploadModal
      isOpen
      onClose={close}
      onCancel={close}
      storage={currentStorage}
      files={files}
      errors={errors}
      isUploading={uploading}
      onFilesSelected={selectFiles}
      onConfirmUpload={() => upload()}
      onRetryFile={(id) => {
        const file = files.find((file) => file.id === id);
        if (file) upload([file]);
      }}
      onRemoveFile={(id) => {
        if (
          lock.current ||
          files.find((file) => file.id === id)?.status === "completed"
        )
          return;
        setFiles((previous) => previous.filter((file) => file.id !== id));
        setErrors((previous) => previous.filter((error) => error.id !== id));
      }}
      onViewPlans={onViewPlans}
    />
  );
}
