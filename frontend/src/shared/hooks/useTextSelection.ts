import { useCallback } from "react";
import { useStore } from "@/shared/store";

export function useTextSelection(containerRef: React.RefObject<HTMLDivElement | null>) {
  const setSelection = useStore((s) => s.setSelection);

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !containerRef.current) {
      return;
    }

    const rawText = sel.toString();
    if (!rawText.trim()) return;

    const range = sel.getRangeAt(0);
    const containerNode = containerRef.current;

    const rawStart = getTextOffset(containerNode, range.startContainer, range.startOffset);
    const rawEnd = getTextOffset(containerNode, range.endContainer, range.endOffset);

    const leadTrim = rawText.length - rawText.trimStart().length;
    const tailTrim = rawText.length - rawText.trimEnd().length;

    const startIndex = rawStart + leadTrim;
    const endIndex = rawEnd - tailTrim;

    const text = rawText.trim();
    if (endIndex <= startIndex) return;

    const rangeRect = range.getBoundingClientRect();
    setSelection({
      text,
      startIndex,
      endIndex,
      rect: {
        top: rangeRect.top,
        left: rangeRect.left,
        bottom: rangeRect.bottom,
        right: rangeRect.right,
        width: rangeRect.width,
        height: rangeRect.height,
      },
    });
  }, [containerRef, setSelection]);

  return handleMouseUp;
}

function getTextOffset(
  root: Node,
  targetNode: Node,
  targetOffset: number
): number {
  let offset = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  while (walker.nextNode()) {
    if (walker.currentNode === targetNode) {
      return offset + targetOffset;
    }
    offset += (walker.currentNode.textContent?.length ?? 0);
  }
  return offset + targetOffset;
}
