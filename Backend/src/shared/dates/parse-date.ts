const DD_MM_YYYY = /^(\d{2})\/(\d{2})\/(\d{4})$/;

// Regresa 'YYYY-MM-DD' listo para una columna DATE, o null si el formato/fecha es inválido.
export const parseDateDDMMYYYY = (value: string): string | null => {
  const match = DD_MM_YYYY.exec(value.trim());
  if (match === null) {
    return null;
  }

  const day = match[1]!;
  const month = match[2]!;
  const year = match[3]!;
  const dayNum = Number(day);
  const monthNum = Number(month);
  const yearNum = Number(year);

  const date = new Date(Date.UTC(yearNum, monthNum - 1, dayNum));
  const isRealDate =
    date.getUTCFullYear() === yearNum &&
    date.getUTCMonth() === monthNum - 1 &&
    date.getUTCDate() === dayNum;

  if (!isRealDate) {
    return null;
  }

  return `${year}-${month}-${day}`;
};
