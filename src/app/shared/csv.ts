type Celda = string | number | null | undefined;

/**
 * Arma un CSV y lo descarga en el navegador.
 *  - Separador ";" y BOM UTF-8: así Excel en español abre las columnas y las tildes bien.
 *  - Los textos que empiezan con = + - @ se neutralizan (evita fórmulas maliciosas en Excel).
 */
export function descargarCsv(nombreArchivo: string, columnas: string[], filas: Celda[][]): void {
  const sep = ';';

  const celda = (v: Celda): string => {
    if (v === null || v === undefined) return '';
    let s = typeof v === 'number' ? String(v).replace('.', ',') : v;
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const contenido =
    '\uFEFF' + [columnas, ...filas].map((fila) => fila.map(celda).join(sep)).join('\r\n');

  const url = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}