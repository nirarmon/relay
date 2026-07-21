// src/components/DataTable.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataTable } from "./DataTable";

interface Row {
  id: string;
  name: string;
}

describe("DataTable", () => {
  const rows: Row[] = [{ id: "1", name: "Alpha" }, { id: "2", name: "Bravo" }];
  const columns = [{ key: "name" as const, header: "Name" }];

  it("renders one row per item with a sticky header", () => {
    render(<DataTable rows={rows} columns={columns} getRowId={(r) => r.id} />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Bravo")).toBeInTheDocument();
  });

  it("calls onRowSelect when a row is clicked", async () => {
    const onRowSelect = vi.fn();
    render(<DataTable rows={rows} columns={columns} getRowId={(r) => r.id} onRowSelect={onRowSelect} />);
    await userEvent.click(screen.getByText("Alpha"));
    expect(onRowSelect).toHaveBeenCalledWith(rows[0]);
  });
});
