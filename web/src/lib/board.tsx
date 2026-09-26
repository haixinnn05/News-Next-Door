import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { BOARDS, DEFAULT_BOARD_ID, type Board } from "../../../server/lib/boards.ts";
import { api } from "./api";

const KEY = "btv-board";

const BoardCtx = createContext<{ board: Board; boards: Board[]; setBoard: (id: string) => void }>({
  board: BOARDS[0],
  boards: BOARDS,
  setBoard: () => {},
});

export function BoardProvider({ children }: { children: ReactNode }) {
  const [boards, setBoards] = useState<Board[]>(BOARDS);
  const [id, setId] = useState(() => localStorage.getItem(KEY) || DEFAULT_BOARD_ID);
  useEffect(() => {
    api.boards().then((r) => setBoards(r.boards)).catch(() => {});
  }, []);
  const board = boards.find((b) => b.id === id) ?? boards.find((b) => b.id === DEFAULT_BOARD_ID) ?? boards[0];
  const setBoard = (next: string) => {
    if (!boards.some((b) => b.id === next)) return;
    localStorage.setItem(KEY, next);
    setId(next);
  };
  return <BoardCtx.Provider value={{ board, boards, setBoard }}>{children}</BoardCtx.Provider>;
}

export const useBoard = () => useContext(BoardCtx);
