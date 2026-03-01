"""
Invoice Parser API
Точка входа Flask-приложения.
"""
import os
import uuid
import tempfile
from pathlib import Path

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

from app.extractor import extract_invoice
from app.excel_builder import build_excel
from app.validators import validate_invoice_data

# ── Конфигурация ──────────────────────────────────────────────
UPLOAD_FOLDER = Path(os.getenv("UPLOAD_FOLDER", "uploads"))
OUTPUT_FOLDER = Path(os.getenv("OUTPUT_FOLDER", "outputs"))
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", 50))
MAX_CONTENT_LENGTH = MAX_FILE_SIZE_MB * 1024 * 1024

UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
OUTPUT_FOLDER.mkdir(parents=True, exist_ok=True)

# ── Flask app ─────────────────────────────────────────────────
app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH
CORS(app)


# ── Routes ────────────────────────────────────────────────────

@app.get("/health")
def health():
    return jsonify({"status": "ok", "version": "1.0.0"})


@app.post("/convert")
def convert():
    """
    multipart/form-data:
      file         — PDF-файл (обязательно)
      vision_only  — 'true' | 'false' (по умолчанию false)
      provider     — 'anthropic' | 'openrouter' | 'openai'
      output       — 'json' | 'xlsx' | 'both' (по умолчанию 'both')
    """
    # ── Валидация входа ──────────────────────────────────────
    if "file" not in request.files:
        return jsonify({"error": "Поле 'file' обязательно"}), 400

    file = request.files["file"]
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Принимаются только PDF-файлы"}), 400

    vision_only = request.form.get("vision_only", "false").lower() == "true"
    provider = request.form.get("provider", os.getenv("LLM_PROVIDER", "anthropic"))
    output_mode = request.form.get("output", "both")  # json | xlsx | both

    # ── Сохраняем загруженный файл ───────────────────────────
    job_id = str(uuid.uuid4())
    pdf_path = UPLOAD_FOLDER / f"{job_id}.pdf"
    file.save(pdf_path)

    try:
        # ── Извлечение данных ────────────────────────────────
        invoice_data, used_vision = extract_invoice(
            pdf_path=str(pdf_path),
            vision_only=vision_only,
            provider=provider,
        )

        # ── Валидация ────────────────────────────────────────
        warnings = validate_invoice_data(invoice_data)
        invoice_data["warnings"] = invoice_data.get("warnings", []) + warnings
        parse_quality = "ok" if not warnings else "partial"

        # ── Формирование ответа ──────────────────────────────
        headers = {
            "X-Vision-Fallback": str(used_vision).lower(),
            "X-Document-Type": "invoice",
            "X-Parse-Quality": parse_quality,
            "X-Job-Id": job_id,
        }

        if output_mode == "json":
            return jsonify(invoice_data), 200, headers

        # Строим Excel
        xlsx_path = OUTPUT_FOLDER / f"{job_id}.xlsx"
        build_excel(invoice_data, str(xlsx_path))

        if output_mode == "xlsx":
            return send_file(
                str(xlsx_path),
                mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                as_attachment=True,
                download_name=f"invoice_{invoice_data.get('invoice_number', job_id)}.xlsx",
            ), 200, headers

        # both — возвращаем JSON + путь к файлу
        invoice_data["xlsx_job_id"] = job_id
        return jsonify(invoice_data), 200, headers

    except Exception as exc:
        return jsonify({"error": str(exc), "job_id": job_id}), 500

    finally:
        # Удаляем временный PDF
        try:
            pdf_path.unlink(missing_ok=True)
        except Exception:
            pass


@app.get("/download/<job_id>")
def download(job_id: str):
    """Скачать уже готовый xlsx по job_id."""
    # Санитизация: только uuid4-символы
    safe = "".join(c for c in job_id if c.isalnum() or c == "-")
    xlsx_path = OUTPUT_FOLDER / f"{safe}.xlsx"
    if not xlsx_path.exists():
        return jsonify({"error": "Файл не найден"}), 404
    return send_file(
        str(xlsx_path),
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=f"invoice_{safe}.xlsx",
    )


# ── Dev-запуск ────────────────────────────────────────────────
if __name__ == "__main__":
    host = os.getenv("FLASK_HOST", "0.0.0.0")
    port = int(os.getenv("FLASK_PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(host=host, port=port, debug=debug)
