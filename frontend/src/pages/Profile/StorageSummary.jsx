import { useEffect, useState, useCallback } from "react";
import { getMyStorage } from "../../services/profileService";

function StorageSummary() {
  const [storage, setStorage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStorage = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);

    try {
      const data = await getMyStorage();
      setStorage(data);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStorage(true);

    const handleStorageUpdated = () => {
      loadStorage();
    };

    window.addEventListener(
      "cloudbox:storage-updated",
      handleStorageUpdated
    );

    return () => {
      window.removeEventListener(
        "cloudbox:storage-updated",
        handleStorageUpdated
      );
    };
  }, [loadStorage]);

  const formatStorage = (bytes) => {
    const GB = 1024 * 1024 * 1024;
    const MB = 1024 * 1024;
    const KB = 1024;

    if (bytes === 0) return "0 B";
    if (bytes < KB) return `${bytes} B`;
    if (bytes < MB) return `${(bytes / KB).toFixed(2)} KB`;
    if (bytes < GB) return `${(bytes / MB).toFixed(2)} MB`;

    return `${(bytes / GB).toFixed(2)} GB`;
  };

  if (isLoading) {
    return (
      <section className="storageSummary">
        <p>Cargando almacenamiento...</p>
      </section>
    );
  }

  if (error && !storage) {
    return (
      <section className="storageSummary">
        <p role="alert">{error}</p>
      </section>
    );
  }

  if (!storage) return null;

  const storageCapacityGb = storage.plan.espacio_maximo_gb;

  const usagePercent = Math.min(
    100,
    Math.max(0, storage.percentageUsed)
  );

  const storageColorClass =
    usagePercent > 80
      ? "storageSummaryFillRed"
      : usagePercent > 50
        ? "storageSummaryFillYellow"
        : "storageSummaryFillBlue";

  return (
    <section
      className="storageSummary"
      aria-labelledby="storageSummaryTitle"
    >
      <div>
        <div className="storageSummaryHeader">
          <h2
            className="storageSummaryTitle"
            id="storageSummaryTitle"
          >
            Espacio utilizado
          </h2>

          <span className="storagePlanBadge">
            Plan {storage.plan.nombre}
          </span>
        </div>

        <p className="storageSummaryAvailable">
          {formatStorage(storage.usedBytes)} de{" "}
          {storageCapacityGb} GB usado
        </p>

        <div
          className="storageSummaryTrack"
          role="progressbar"
          aria-label="Almacenamiento usado"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={usagePercent}
        >
          <div
            className={`storageSummaryFill ${storageColorClass}`}
            style={{
              width: `${usagePercent}%`,
            }}
          />
        </div>

        <div className="storageSummaryFooter">
          <span>{usagePercent}% usado</span>

          <span>
            {formatStorage(storage.availableBytes)} disponibles
          </span>
        </div>

        {error && <p role="alert">{error}</p>}
      </div>
    </section>
  );
}

export default StorageSummary;