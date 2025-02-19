
class ProgressSpan {
    unitsDone: number;
    constructor(public parent: Progress, public parentUnits: number, public spanUnits: number) {
        this.unitsDone = 0;
    }

    done(units?: number) {
        const remaining = this.spanUnits - this.unitsDone;
        if (!remaining) return; // ignore if already done
        if (!units || units > remaining) {
            units = remaining;
        }
        this.unitsDone += units;
        this.parent.done(units * this.parentUnits / this.spanUnits);
    }

    get parentUnitsDone() {
        return Math.round(this.unitsDone * this.parentUnits / this.spanUnits);
    }

    get isDone() {
        return this.unitsDone >= this.spanUnits;
    }
}

export class Progress {
    unitsDone: number = 0;

    constructor(public total: number) {
    }

    get fraction() {
        return this.unitsDone / this.total;
    }

    get percent() {
        return Math.round(this.fraction * 100);
    }

    get isDone() {
        return this.unitsDone >= this.total;
    }

    done(units?: number) {
        const remaining = this.total - this.unitsDone;
        if (!remaining) return; // ignore if already done
        if (!units || units > remaining) {
            units = remaining;
        }
        this.unitsDone += units;
    }

    span(units: number, spanUnits?: number): ProgressSpan {
        return new ProgressSpan(this, units, spanUnits || units);
    }
}