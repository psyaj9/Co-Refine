import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTextSelection } from "@/hooks/useTextSelection";
import { useStore } from "@/stores/store";

vi.mock("@/stores/store", () => ({
  useStore: vi.fn(),
}));

const mockedUseStore = vi.mocked(useStore);

describe("useTextSelection", () => {
  const setSelection = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseStore.mockImplementation((sel) =>
      sel({
        setSelection,
      } as never)
    );
  });

  it("does nothing when selection is collapsed", () => {
    vi.spyOn(window, "getSelection").mockReturnValue({
      isCollapsed: true,
      toString: () => "",
    } as unknown as Selection);

    const ref = { current: document.createElement("div") };
    const { result } = renderHook(() => useTextSelection(ref));

    act(() => {
      result.current();
    });

    expect(setSelection).not.toHaveBeenCalled();
  });

  it("does nothing when selection is whitespace only", () => {
    vi.spyOn(window, "getSelection").mockReturnValue({
      isCollapsed: false,
      toString: () => "   ",
      getRangeAt: vi.fn(),
    } as unknown as Selection);

    const ref = { current: document.createElement("div") };
    const { result } = renderHook(() => useTextSelection(ref));

    act(() => {
      result.current();
    });

    expect(setSelection).not.toHaveBeenCalled();
  });

  it("does nothing when containerRef is null", () => {
    vi.spyOn(window, "getSelection").mockReturnValue({
      isCollapsed: false,
      toString: () => "hello",
    } as unknown as Selection);

    const ref = { current: null };
    const { result } = renderHook(() => useTextSelection(ref));

    act(() => {
      result.current();
    });

    expect(setSelection).not.toHaveBeenCalled();
  });

  it("calls setSelection with trimmed text and rect", () => {
    const container = document.createElement("div");
    const textNode = document.createTextNode("hello world");
    container.appendChild(textNode);

    vi.spyOn(window, "getSelection").mockReturnValue({
      isCollapsed: false,
      toString: () => "hello",
      getRangeAt: () => ({
        startContainer: textNode,
        startOffset: 0,
        endContainer: textNode,
        endOffset: 5,
        getBoundingClientRect: () => ({
          top: 10,
          left: 20,
          bottom: 30,
          right: 80,
          width: 60,
          height: 20,
        }),
      }),
    } as unknown as Selection);

    const ref = { current: container };
    const { result } = renderHook(() => useTextSelection(ref));

    act(() => {
      result.current();
    });

    expect(setSelection).toHaveBeenCalledWith({
      text: "hello",
      startIndex: 0,
      endIndex: 5,
      rect: expect.objectContaining({
        top: 10,
        left: 20,
        width: 60,
      }),
    });
  });
});
