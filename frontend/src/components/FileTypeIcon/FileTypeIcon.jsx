import {
  FileText,
  Folder,
  FileImage,
  Archive,
  Presentation,
} from "lucide-react";

export default function FileTypeIcon({ type, className = "mf-type-icon" }) {
  const styles = {
    carpeta: ["#e0e7ff", "#4f46e5", Folder],
    pdf: ["#fee2e2", "#ef4444", FileText],
    docx: ["#dbeafe", "#1565c0", FileText],
    pptx: ["#fef3c7", "#b98900", Presentation],
    zip: ["#f1f5f9", "#475569", Archive],
    png: ["#fce7f3", "#db2777", FileImage],
    jpg: ["#fce7f3", "#db2777", FileImage],
    jpeg: ["#fce7f3", "#db2777", FileImage],
    image: ["#fce7f3", "#db2777", FileImage],
  };
  const [background, color, Icon] = styles[type] || [
    "#dbeafe",
    "#1565c0",
    FileText,
  ];
  return (
    <span className={className} style={{ background, color }}>
      <Icon size={16} aria-hidden="true" />
    </span>
  );
}
