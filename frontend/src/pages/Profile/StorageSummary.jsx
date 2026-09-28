// Valores de ejemplo locales; no se consultan ni guardan en un servicio.
const storageCapacityGb = 100;
const storageUsagePercent = 30;

function StorageSummary() {
	const boundedUsagePercent = Math.min(100, Math.max(0, storageUsagePercent));
	const availableStorageGb = storageCapacityGb * (1 - boundedUsagePercent / 100);

	return (
		<section className="storageSummary" aria-labelledby="storageSummaryTitle">
			<div>
				<h2 className="storageSummaryTitle" id="storageSummaryTitle">Espacio utilizado</h2>
				<p className="storageSummaryAvailable">
					{availableStorageGb} GB disponibles
				</p>
				<div
					className="storageSummaryTrack"
					role="progressbar"
					aria-label="Almacenamiento usado"
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={boundedUsagePercent}
				>
					<div
						className="storageSummaryFill"
						style={{ width: `${boundedUsagePercent}%` }}
					/>
				</div>
				<p className="storageSummaryFooter">
					{boundedUsagePercent}% usado
				</p>
			</div>
		</section>
	);
}

export default StorageSummary;
