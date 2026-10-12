#!/usr/bin/env python3
"""
Извлекает plaintext из DOCX, DOC или TXT-файла.
Принимает путь к файлу первым аргументом, выводит текст в stdout.
"""
import sys
import os

def extract_docx(path: str) -> str:
    import zipfile
    import xml.etree.ElementTree as ET
    with zipfile.ZipFile(path) as z:
        with z.open("word/document.xml") as f:
            tree = ET.parse(f)
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    parts = []
    for elem in tree.iter():
        if elem.tag == "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t":
            if elem.text:
                parts.append(elem.text)
        if elem.tag == "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p":
            parts.append("\n")
    return "".join(parts)

def extract_doc(path: str) -> str:
    import olefile
    import struct
    import re
    f = olefile.OleFileIO(path)
    wd = f.openstream("WordDocument").read()
    data = wd
    results = []
    i = 0
    current = []
    while i < len(data) - 1:
        val = (data[i + 1] << 8) | data[i]
        if (0x0400 <= val <= 0x04FF) or (0x0020 <= val <= 0x007E) or val in (0x000D, 0x000A):
            try:
                current.append(chr(val))
            except Exception:
                pass
            i += 2
        else:
            if len(current) > 5:
                text = "".join(current).strip()
                if re.search(r"[А-Яа-яёЁ]{3,}", text):
                    results.append(text)
            current = []
            i += 1
    f.close()
    return "\n".join(results)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("Usage: extract_doc_text.py <filepath>")
    path = sys.argv[1]
    ext = os.path.splitext(path)[1].lower()
    if ext == ".docx":
        print(extract_docx(path))
    elif ext == ".doc":
        print(extract_doc(path))
    elif ext == ".txt":
        with open(path, encoding="utf-8", errors="replace") as fh:
            print(fh.read())
    else:
        sys.exit(f"Unsupported extension: {ext}")
