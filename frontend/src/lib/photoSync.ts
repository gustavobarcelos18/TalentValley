type PhotoChangeListener = () => void;

const listeners = new Set<PhotoChangeListener>();

// Minimal cross-component signal so mounted header avatars can refresh after a
// successful student photo upload or removal. Kept intentionally tiny: profile
// photo paths often stay the same protected endpoint, so plain profile
// refetches are not enough to invalidate the cached image bytes.
export function subscribePhotoChange(listener: PhotoChangeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyPhotoChange(): void {
  for (const listener of Array.from(listeners)) listener();
}
