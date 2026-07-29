export function buildScheduleRowLayout(
  rows: Array<{ id: number; auxiliaryCount: number }>,
  rowHeight: number,
  auxiliaryRowHeight: number
) {
  const taskTopPixelByTaskId = new Map<number, number>();
  let totalHeight = 0;

  for (const row of rows) {
    taskTopPixelByTaskId.set(row.id, totalHeight);
    totalHeight += rowHeight + row.auxiliaryCount * auxiliaryRowHeight;
  }

  return { taskTopPixelByTaskId, totalHeight };
}
