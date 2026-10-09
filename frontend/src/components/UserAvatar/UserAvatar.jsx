import { useState } from "react";
import "./UserAvatar.css";

export default function UserAvatar({ user, className = "" }) {
  const [failedUrl, setFailedUrl] = useState(null);
  const initials = (user.name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return (
    <span className={`user-avatar ${className}`}>
      {user.avatarUrl && failedUrl !== user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={`Foto de ${user.name}`}
          onError={() => setFailedUrl(user.avatarUrl)}
        />
      ) : (
        <span aria-label={user.name}>{initials || "?"}</span>
      )}
    </span>
  );
}
