/**
 * גאומטריית חיתוך תמונה טהורה (ללא DOM) לבורר החיתוך בטופס המיתוג.
 * הרכיב מתרגם גרירה/זום לערכי offset/zoom, קורא ל-computeCropRect
 * ומצייר את המלבן שהתקבל אל קנבס הפלט. הפונקציות כאן נבדקות ביחידה.
 */

export interface CropInput {
  /** רוחב טבעי של התמונה במקור (פיקסלים). */
  naturalWidth: number;
  /** גובה טבעי של התמונה במקור (פיקסלים). */
  naturalHeight: number;
  /** יחס גובה-רוחב היעד (רוחב / גובה). לוגו = 1, באנר = 16/9. */
  targetAspect: number;
  /** מקדם זום ‎(>= 1). ‎1 = החיתוך הגדול ביותר שנכנס במקור. */
  zoom: number;
  /** הזזה אופקית מהמרכז בטווח ‎[-1, 1]. */
  offsetX: number;
  /** הזזה אנכית מהמרכז בטווח ‎[-1, 1]. */
  offsetY: number;
}

export interface CropRect {
  sx: number;
  sy: number;
  sWidth: number;
  sHeight: number;
}

/** מגביל ערך לטווח ‎[min, max]. */
export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * גודל החיתוך הגדול ביותר ביחס היעד שנכנס במלואו בתוך התמונה (zoom=1).
 */
export function maxCropSize(
  naturalWidth: number,
  naturalHeight: number,
  targetAspect: number,
): { width: number; height: number } {
  if (naturalWidth <= 0 || naturalHeight <= 0 || targetAspect <= 0) {
    return { width: 0, height: 0 };
  }
  const sourceAspect = naturalWidth / naturalHeight;
  if (sourceAspect > targetAspect) {
    // המקור רחב מהיעד ⇐ הגובה הוא הגורם המגביל.
    const height = naturalHeight;
    return { width: height * targetAspect, height };
  }
  // המקור צר/שווה ⇐ הרוחב הוא הגורם המגביל.
  const width = naturalWidth;
  return { width, height: width / targetAspect };
}

/**
 * מחשב את מלבן המקור (sx, sy, sWidth, sHeight) לציור אל קנבס הפלט,
 * לפי זום והזזה מנורמלת. שומר על החיתוך בתוך גבולות התמונה.
 */
export function computeCropRect(input: CropInput): CropRect {
  const { naturalWidth, naturalHeight, targetAspect } = input;
  if (naturalWidth <= 0 || naturalHeight <= 0 || targetAspect <= 0) {
    return { sx: 0, sy: 0, sWidth: 0, sHeight: 0 };
  }
  const base = maxCropSize(naturalWidth, naturalHeight, targetAspect);
  const zoom = Math.max(1, input.zoom);
  const sWidth = base.width / zoom;
  const sHeight = base.height / zoom;

  const freeX = naturalWidth - sWidth;
  const freeY = naturalHeight - sHeight;
  const offsetX = clamp(input.offsetX, -1, 1);
  const offsetY = clamp(input.offsetY, -1, 1);

  const sx = clamp((freeX / 2) * (1 + offsetX), 0, freeX);
  const sy = clamp((freeY / 2) * (1 + offsetY), 0, freeY);

  return { sx, sy, sWidth, sHeight };
}

/**
 * ממדי קנבס הפלט ליחס היעד, חסום לרוחב/גובה מרביים, מעוגל לשלמים.
 */
export function outputSize(params: {
  targetAspect: number;
  maxWidth: number;
  maxHeight: number;
}): { width: number; height: number } {
  const { targetAspect, maxWidth, maxHeight } = params;
  if (targetAspect <= 0 || maxWidth <= 0 || maxHeight <= 0) {
    return { width: 0, height: 0 };
  }
  let width = maxWidth;
  let height = Math.round(width / targetAspect);
  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round(height * targetAspect);
  }
  return { width, height };
}
