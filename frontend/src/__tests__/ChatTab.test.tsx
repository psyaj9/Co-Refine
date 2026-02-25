import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import ChatTab from "@/components/ChatTab";
import { defaultStoreState, mockChatMessage } from "./test-helpers";

expect.extend(toHaveNoViolations);

vi.mock("@/stores/store", () => ({
  useStore: vi.fn(),
}));

import { useStore } from "@/stores/store";
const mockedUseStore = vi.mocked(useStore);

function setup(overrides: Record<string, unknown> = {}) {
  const state = { ...defaultStoreState(), ...overrides };
  mockedUseStore.mockImplementation((sel) => sel(state as never));
  return render(<ChatTab />);
}

describe("ChatTab", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows empty state with suggestion buttons", () => {
    setup({ chatMessages: [] });
    // Should have suggestion buttons
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it("renders messages when present", () => {
    setup({
      chatMessages: [
        mockChatMessage({ role: "user", content: "Hello there" }),
        mockChatMessage({ id: "msg-2", role: "assistant", content: "Hi! How can I help?" }),
      ],
    });
    expect(screen.getByText("Hello there")).toBeInTheDocument();
    expect(screen.getByText("Hi! How can I help?")).toBeInTheDocument();
  });

  it("disables send button when input is empty", () => {
    setup({ chatMessages: [mockChatMessage()] });
    const sendButton = screen.getByLabelText(/send/i);
    expect(sendButton).toBeDisabled();
  });

  it("enables send button when input has text", () => {
    setup({ chatMessages: [mockChatMessage()] });
    const input = screen.getByPlaceholderText(/ask/i);
    fireEvent.change(input, { target: { value: "Test query" } });
    const sendButton = screen.getByLabelText(/send/i);
    expect(sendButton).not.toBeDisabled();
  });

  it("disables send button when streaming", () => {
    setup({
      chatStreaming: true,
      chatMessages: [mockChatMessage()],
    });
    const sendButton = screen.getByLabelText(/send/i);
    expect(sendButton).toBeDisabled();
  });

  it("shows clear button when messages exist", () => {
    setup({ chatMessages: [mockChatMessage()] });
    expect(screen.getByLabelText(/clear/i)).toBeInTheDocument();
  });

  it("calls clearChat on clear button click", () => {
    const clearChat = vi.fn();
    setup({ chatMessages: [mockChatMessage()], clearChat });
    fireEvent.click(screen.getByLabelText(/clear/i));
    expect(clearChat).toHaveBeenCalled();
  });

  it("has chat log role with aria-live", () => {
    setup();
    const log = screen.getByRole("log");
    expect(log).toHaveAttribute("aria-live", "polite");
  });

  it("has no accessibility violations", async () => {
    const { container } = setup();
    expect(await axe(container)).toHaveNoViolations();
  });
});
