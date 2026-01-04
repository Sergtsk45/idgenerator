# AOSR Document Automation System

## Temporary Debugging Measures

- **BoQ Import Overwrite**: For debugging purposes, importing a new Bill of Quantities (BoQ) from Excel will overwrite all existing records in the database. This behavior is intended to allow quick resets during development.
- **Ignored Rows**: The import process automatically skips technical rows (column numbering) and section headers (rows without valid work codes).

## Excel Import Format

The system expects a standard Russian BoQ (ВОР) Excel file with the following column structure:

| Column Index | Header (Russian) | Description |
|--------------|------------------|-------------|
| 0 | № п/п | Row number (ignored for work items) |
| 1 | № в ЛСР | Work code (e.g., "1", "3", "4") |
| 2 | Наименование работ | Work description |
| 3 | Ед. изм. | Unit of measurement |
| 4 | Кол-во | Quantity |
| 5+ | Additional columns | Ignored |

### Rows that are skipped:
- Empty rows
- Title rows (e.g., "Ведомость объёмов работ")
- Column header rows
- Technical numbering rows (1, 2, 3, 4, 5...)
- Section headers (e.g., "Раздел 1. Водомерный узел...")
