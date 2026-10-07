import { ValueTransformer } from 'typeorm';

/** Postgres trả cột numeric dưới dạng chuỗi; chuyển về number (giữ null). */
export const numericTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value === null || value === undefined ? null : Number(value)),
};
