import { addDays, addMonths, addYears, startOfDay, startOfMonth, startOfYear } from 'date-fns'
import { startOfWeek } from '../../../../utils'

/**
 * Date ticks for a time-proportional x-axis drawn on a linear scale over
 * epoch-ms values (3.4.0, date-per-note axis). No Chart.js date adapter is
 * bundled, so the ticks are built here: calendar-aligned (days, weeks,
 * months, years), never more than fit the axis, with a short label format.
 */

/** One way of spacing ticks along the calendar */
interface TickUnit {
    kind: 'day' | 'week' | 'month' | 'year'
    /** How many of `kind` between two ticks */
    step: number
}

/** Candidate spacings, finest first */
const TICK_UNITS: readonly TickUnit[] = [
    { kind: 'day', step: 1 },
    { kind: 'day', step: 2 },
    { kind: 'day', step: 3 },
    { kind: 'week', step: 1 },
    { kind: 'week', step: 2 },
    { kind: 'month', step: 1 },
    { kind: 'month', step: 2 },
    { kind: 'month', step: 3 },
    { kind: 'month', step: 6 },
    { kind: 'year', step: 1 },
    { kind: 'year', step: 2 },
    { kind: 'year', step: 5 },
    { kind: 'year', step: 10 },
    { kind: 'year', step: 25 },
    { kind: 'year', step: 50 },
    { kind: 'year', step: 100 }
]

/** Ticks of the axis and the date-fns format their labels use */
export interface DateTicks {
    values: number[]
    format: string
}

/** First tick of a unit at or after `min` */
function firstTick(min: Date, unit: TickUnit): Date {
    switch (unit.kind) {
        case 'day': {
            const day = startOfDay(min)
            return day.getTime() < min.getTime() ? addDays(day, 1) : day
        }
        case 'week': {
            const week = startOfWeek(min)
            return week.getTime() < min.getTime() ? addDays(week, 7) : week
        }
        case 'month': {
            let month = startOfMonth(min)
            if (month.getTime() < min.getTime()) month = addMonths(month, 1)
            // Align to the step: quarters start in Jan/Apr/Jul/Oct, halves in Jan/Jul
            while (month.getMonth() % unit.step !== 0) month = addMonths(month, 1)
            return month
        }
        case 'year': {
            let year = startOfYear(min)
            if (year.getTime() < min.getTime()) year = addYears(year, 1)
            while (year.getFullYear() % unit.step !== 0) year = addYears(year, 1)
            return year
        }
    }
}

/** The tick after `date` for a unit */
function nextTick(date: Date, unit: TickUnit): Date {
    switch (unit.kind) {
        case 'day':
            return addDays(date, unit.step)
        case 'week':
            return addDays(date, 7 * unit.step)
        case 'month':
            return addMonths(date, unit.step)
        case 'year':
            return addYears(date, unit.step)
    }
}

/** Every tick of a unit in [min, max], stopping early past `limit` */
function ticksFor(min: number, max: number, unit: TickUnit, limit: number): number[] {
    const values: number[] = []
    for (
        let tick = firstTick(new Date(min), unit);
        tick.getTime() <= max;
        tick = nextTick(tick, unit)
    ) {
        values.push(tick.getTime())
        if (values.length > limit) break
    }
    return values
}

/** Label format for a unit: short, with the year only where it is needed */
function formatFor(unit: TickUnit, min: number, max: number): string {
    if (unit.kind === 'year') return 'yyyy'
    if (unit.kind === 'month') return 'MMM yyyy'
    return new Date(min).getFullYear() === new Date(max).getFullYear() ? 'MMM d' : 'MMM d, yyyy'
}

/**
 * Calendar-aligned ticks between `min` and `max` (epoch ms): the finest unit
 * that yields at least one and at most `maxTicks` ticks. A span shorter than a
 * day gets a single tick on its day.
 */
export function buildDateTicks(min: number, max: number, maxTicks: number): DateTicks {
    const limit = Math.max(1, Math.floor(maxTicks))
    if (!(max > min)) {
        return { values: [startOfDay(new Date(min)).getTime()], format: 'MMM d, yyyy' }
    }

    for (const unit of TICK_UNITS) {
        const values = ticksFor(min, max, unit, limit)
        if (values.length >= 1 && values.length <= limit) {
            return { values, format: formatFor(unit, min, max) }
        }
    }

    // Spans beyond centuries: the coarsest unit, thinned to fit
    const coarsest = TICK_UNITS[TICK_UNITS.length - 1]!
    const values = ticksFor(min, max, coarsest, Number.POSITIVE_INFINITY)
    if (values.length === 0) {
        // A span inside one day that crosses no midnight: one tick on its start
        return { values: [min], format: 'MMM d, yyyy' }
    }
    const stride = Math.ceil(values.length / limit)
    return {
        values: values.filter((_, i) => i % stride === 0),
        format: 'yyyy'
    }
}

/**
 * Approximate width a date tick label needs, in pixels, so the tick count
 * follows the axis width (labels stay horizontal and never overlap)
 */
export function dateTickPixelWidth(format: string): number {
    return format.length * 7 + 16
}
