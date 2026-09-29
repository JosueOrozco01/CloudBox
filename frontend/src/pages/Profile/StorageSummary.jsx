// Valores de ejemplo locales; no se consultan ni guardan en un servicio.
const storageCapacityGb = 100;
const storageUsageGb = 70;

function StorageSummary() {
	const boundedUsageGb = Math.min(storageCapacityGb, Math.max(0, storageUsageGb));
	const usagePercent = (boundedUsageGb / storageCapacityGb) * 100;
	const boundedUsagePercent = Math.round(usagePercent);
	const storageColorClass = boundedUsagePercent > 80
		? "storageSummaryFillRed"
		: boundedUsagePercent > 50
			? "storageSummaryFillYellow"
			: "storageSummaryFillBlue";

	return (
		<section className="storageSummary" aria-labelledby="storageSummaryTitle">
			<div>
				<h2 className="storageSummaryTitle" id="storageSummaryTitle">Espacio utilizado</h2>
				<p className="storageSummaryAvailable">
					{boundedUsageGb} GB de {storageCapacityGb} GB usado
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
						className={`storageSummaryFill ${storageColorClass}`}
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
