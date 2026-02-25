import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDraggable } from "@/hooks/useDraggable";

function pointerEvent(overrides: Partial<React.PointerEvent> = {}) {
  return {
    clientX: 0,
    clientY: 0,
    pointerId: 1,
    target: { setPointerCapture: () => {} } as unknown as EventTarget,
    ...overrides,
  } as unknown as React.PointerEvent;
}

describe("useDraggable", () => {
  it("returns initial position", () => {
    const { result } = renderHook(() => useDraggable(100, 200));
    expect(result.current.pos).toEqual({ x: 100, y: 200 });
  });

  it("updates position on drag", () => {
    const { result } = renderHook(() => useDraggable(0, 0));

    act(() => {
      result.current.onPointerDown(pointerEvent({ clientX: 0, clientY: 0 }));
    });

    act(() => {
      result.current.onPointerMove(
        pointerEvent({ clientX: 50, clientY: 30 })
      );
    });

    expect(result.current.pos).toEqual({ x: 50, y: 30 });
  });

  it("stops updating after pointer up", () => {
    const { result } = renderHook(() => useDraggable(0, 0));

    act(() => {
      result.current.onPointerDown(pointerEvent({ clientX: 0, clientY: 0 }));
    });

    act(() => {
      result.current.onPointerUp();
    });

    act(() => {
      result.current.onPointerMove(
        pointerEvent({ clientX: 100, clientY: 100 })
      );
    });

    // Should not have changed since drag ended
    expect(result.current.pos).toEqual({ x: 0, y: 0 });
  });

  it("re-syncs when initial coords change", () => {
    const { result, rerender } = renderHook(
      ({ x, y }) => useDraggable(x, y),
      { initialProps: { x: 10, y: 20 } }
    );

    expect(result.current.pos).toEqual({ x: 10, y: 20 });

    rerender({ x: 50, y: 60 });
    expect(result.current.pos).toEqual({ x: 50, y: 60 });
  });

  it("returns stable callback references", () => {
    const { result, rerender } = renderHook(() => useDraggable(0, 0));
    const { onPointerMove, onPointerUp } = result.current;

    rerender();
    expect(result.current.onPointerMove).toBe(onPointerMove);
    expect(result.current.onPointerUp).toBe(onPointerUp);
  });
});
