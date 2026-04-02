import { describe, expect, it } from "vitest";
import { preprocessMathDelimiters } from "./preprocessMathDelimiters";

describe("preprocessMathDelimiters", () => {
    it("preserves LaTeX patterns (commands, subscripts, superscripts, braces)", () => {
        expect(preprocessMathDelimiters("$x = \\frac{-b}{2a}$")).toBe("$x = \\frac{-b}{2a}$");
        expect(preprocessMathDelimiters("$n^2$")).toBe("$n^2$");
        expect(preprocessMathDelimiters("$a_{ij}$")).toBe("$a_{ij}$");
    });

    it("preserves single-letter variables and variable assignments", () => {
        expect(preprocessMathDelimiters("rate $r$ can be expressed")).toBe("rate $r$ can be expressed");
        expect(preprocessMathDelimiters("where $r = 0.235$ (growth)")).toBe("where $r = 0.235$ (growth)");
    });

    it("preserves ion notation (^+ and ^-)", () => {
        expect(preprocessMathDelimiters("$Ca^+$")).toBe("$Ca^+$");
        expect(preprocessMathDelimiters("$Cl^-$")).toBe("$Cl^-$");
        expect(preprocessMathDelimiters("$Ca^{2+}$")).toBe("$Ca^{2+}$");
    });

    it("preserves display math ($$...$$)", () => {
        expect(preprocessMathDelimiters("$$E = mc^2$$")).toBe("$$E = mc^2$$");
        expect(preprocessMathDelimiters("$$\nx = \\frac{-b}{2a}\n$$")).toBe("$$\nx = \\frac{-b}{2a}\n$$");
    });

    it("escapes currency amounts", () => {
        expect(preprocessMathDelimiters("between $100M and $500M")).toBe("between \\$100M and \\$500M");
        expect(preprocessMathDelimiters("all $ figures by $500k")).toBe("all \\$ figures by \\$500k");
        expect(preprocessMathDelimiters("$100K-$500K range")).toBe("\\$100K-\\$500K range");
    });

    it("preserves uncertain content as fallback", () => {
        expect(preprocessMathDelimiters("$100 + 200$")).toBe("$100 + 200$");
    });

    it("skips inline code and fenced code blocks", () => {
        expect(preprocessMathDelimiters("use `$100 and $200` as values")).toBe("use `$100 and $200` as values");
        const fenced = "costs $100M and $500M\n```\nprice = $200\n```";
        expect(preprocessMathDelimiters(fenced)).toBe("costs \\$100M and \\$500M\n```\nprice = $200\n```");
    });

    it("no-ops on empty string and strings without $", () => {
        expect(preprocessMathDelimiters("")).toBe("");
        expect(preprocessMathDelimiters("no dollars here")).toBe("no dollars here");
    });

    it("does not double-escape already escaped \\$", () => {
        expect(preprocessMathDelimiters("costs \\$100")).toBe("costs \\$100");
    });

    it("replaces \\$ inside LaTeX spans with \\text{\\textdollar}", () => {
        expect(preprocessMathDelimiters("where $P = \\$2,847,500$ end"))
            .toBe("where $P = \\text{\\textdollar}2,847,500$ end");
    });

    it("does not replace \\$ outside LaTeX spans", () => {
        expect(preprocessMathDelimiters("costs \\$100")).toBe("costs \\$100");
    });

    it("escapes currency $ adjacent to LaTeX pairs", () => {
        expect(preprocessMathDelimiters("costs $500M. Also $x = \\frac{1}{2}$ works"))
            .toBe("costs \\$500M. Also $x = \\frac{1}{2}$ works");
    });

    it("handles currency and LaTeX on separate lines", () => {
        expect(preprocessMathDelimiters("between $100M and $500M\nwhere $x = \\frac{1}{2}$"))
            .toBe("between \\$100M and \\$500M\nwhere $x = \\frac{1}{2}$");
    });

    it("handles mixed currency, LaTeX, and \\$ in a financial report line", () => {
        const input = "Where $F = \\$567,800$ (fixed costs), $P = \\$89.99$ (price), and $V = \\$0.42$ (variable). This yields $Q_{\\text{BE}} = 6,338$ units.";
        const result = preprocessMathDelimiters(input);
        expect(result).toContain("$F = \\text{\\textdollar}567,800$");
        expect(result).toContain("$P = \\text{\\textdollar}89.99$");
        expect(result).toContain("$V = \\text{\\textdollar}0.42$");
        expect(result).toContain("$Q_{\\text{BE}} = 6,338$");
    });

    it("handles interleaved currency, inline LaTeX, and display math", () => {
        const input = "The report for $500M shows that (given $sales = x*e^{y}$) we were off by $15M. This is from $$variance = x*v/2*e^(y-y`)$$";
        const result = preprocessMathDelimiters(input);
        expect(result).toContain("$sales = x*e^{y}$");
        expect(result).toContain("$$variance = x*v/2*e^(y-y`)$$");
        expect(result).toContain("\\$500M");
    });
});
