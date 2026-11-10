const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

export function spotlightBounds(rect, viewport, padding = 8) {
  if (!rect) return null;
  const left = clamp(rect.left - padding, 6, viewport.width - 6);
  const top = clamp(rect.top - padding, 6, viewport.height - 6);
  const right = clamp(rect.right + padding, left, viewport.width - 6);
  const bottom = clamp(rect.bottom + padding, top, viewport.height - 6);
  if (right <= left || bottom <= top) return null;
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

export function positionTourCard(target, card, viewport) {
  const margin = 16, gap = 20;
  const width = Math.min(380, viewport.width - margin * 2);
  const height = Math.min(card.height, viewport.height - margin * 2);
  const centered = { left: (viewport.width - width) / 2, top: (viewport.height - height) / 2, width, height, side: 'center', arrow: 0 };
  if (!target) return centered;
  const centerX = target.left + target.width / 2, centerY = target.top + target.height / 2;
  let side, left, top;
  if (target.bottom + gap + height <= viewport.height - margin) {
    side = 'bottom'; left = centerX - width / 2; top = target.bottom + gap;
  } else if (target.right + gap + width <= viewport.width - margin) {
    side = 'right'; left = target.right + gap; top = centerY - height / 2;
  } else if (target.top - gap - height >= margin) {
    side = 'top'; left = centerX - width / 2; top = target.top - gap - height;
  } else if (target.left - gap - width >= margin) {
    side = 'left'; left = target.left - gap - width; top = centerY - height / 2;
  } else {
    // A tall region on a phone leaves a compact card docked to the viewport.
    return { ...centered, top: viewport.height - height - margin };
  }
  left = clamp(left, margin, viewport.width - width - margin);
  top = clamp(top, margin, viewport.height - height - margin);
  const arrow = ['top', 'bottom'].includes(side)
    ? clamp(centerX - left, 25, width - 25)
    : clamp(centerY - top, 25, height - 25);
  return { left, top, width, height, side, arrow };
}
