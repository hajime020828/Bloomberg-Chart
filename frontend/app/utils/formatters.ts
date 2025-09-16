// app/utils/formatters.ts

/**
 * 数値を小数点2桁でフォーマット
 */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '---';
  }
  return value.toFixed(2);
}

/**
 * パーセンテージを小数点2桁でフォーマット
 */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '---';
  }
  return value.toFixed(2);
}

/**
 * 大きな数値を単位付きでフォーマット (K, M, B)
 */
export function formatLargeNumber(value: number): string {
  if (value >= 1_000_000_000) {
    return (value / 1_000_000_000).toFixed(2) + 'B';
  }
  if (value >= 1_000_000) {
    return (value / 1_000_000).toFixed(2) + 'M';
  }
  if (value >= 1_000) {
    return (value / 1_000).toFixed(2) + 'K';
  }
  return value.toString();
}

/**
 * 日付を日本時間でフォーマット
 */
export function formatDateTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * 時刻のみフォーマット
 */
export function formatTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}