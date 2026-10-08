import { afterEach, describe, expect, it, vi } from "vitest";
import { notifyPhotoChange, subscribePhotoChange } from "@/lib/photoSync";

const unsubscribers: Array<() => void> = [];

function subscribe(listener: () => void) {
  const unsubscribe = subscribePhotoChange(listener);
  unsubscribers.push(unsubscribe);
  return unsubscribe;
}

afterEach(() => {
  unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
});

describe("photoSync", () => {
  it("notifies every subscriber until it unsubscribes", () => {
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = subscribe(first);
    const unsubscribeSecond = subscribe(second);

    notifyPhotoChange();
    unsubscribeFirst();
    notifyPhotoChange();
    unsubscribeSecond();
    notifyPhotoChange();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
  });

  it("lets a listener unsubscribe itself while being notified", () => {
    const other = vi.fn();
    const self = vi.fn(() => unsubscribeSelf());
    const unsubscribeSelf = subscribe(self);
    subscribe(other);

    notifyPhotoChange();
    notifyPhotoChange();

    expect(self).toHaveBeenCalledTimes(1);
    expect(other).toHaveBeenCalledTimes(2);
  });
});
