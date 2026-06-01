import dayjs from 'dayjs';

export function djs(date?: string | Date | number) {
    const d = dayjs(date);
    return d;
}
