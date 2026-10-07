/** Lưu nội dung (chuỗi, Blob) thành file tải về. */
export function saveFile(content, filename, mime = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Lấy tên file từ header Content-Disposition (nếu có). */
export function filenameFrom(res, fallback) {
  const header = res.headers.get('Content-Disposition') || '';
  const m = header.match(/filename="?([^";]+)"?/i);
  return m ? m[1] : fallback;
}
