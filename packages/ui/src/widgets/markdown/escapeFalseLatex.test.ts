import { describe, expect, it } from "vitest";
import { escapeFalseLatex } from "./escapeFalseLatex";

describe("escapeFalseLatex", () => {
    // --- Definitely LaTeX (preserved) ---

    it("preserves LaTeX with backslash command", () => {
        expect(escapeFalseLatex("$x = \\frac{-b}{2a}$")).toBe("$x = \\frac{-b}{2a}$");
    });

    it("preserves LaTeX with Greek letters", () => {
        expect(escapeFalseLatex("$\\alpha + \\beta$")).toBe("$\\alpha + \\beta$");
    });

    it("preserves LaTeX with superscript", () => {
        expect(escapeFalseLatex("$n^2$")).toBe("$n^2$");
    });

    it("preserves LaTeX with subscript", () => {
        expect(escapeFalseLatex("$a_{ij}$")).toBe("$a_{ij}$");
    });

    it("preserves ion notation with ^+", () => {
        expect(escapeFalseLatex("$Ca^+$")).toBe("$Ca^+$");
    });

    it("preserves ion notation with ^- ", () => {
        expect(escapeFalseLatex("$Cl^-$")).toBe("$Cl^-$");
    });

    it("preserves ion notation with braces", () => {
        expect(escapeFalseLatex("$Ca^{2+}$")).toBe("$Ca^{2+}$");
    });

    it("preserves display math ($$...$$)", () => {
        expect(escapeFalseLatex("$$E = mc^2$$")).toBe("$$E = mc^2$$");
    });

    it("preserves multiline display math", () => {
        const input = "$$\nx = \\frac{-b}{2a}\n$$";
        expect(escapeFalseLatex(input)).toBe(input);
    });

    // --- Definitely not LaTeX (escaped) ---

    it("escapes currency amounts with space before closing $", () => {
        expect(escapeFalseLatex("between $100M and $500M")).toBe("between \\$100M and \\$500M");
    });

    it("escapes dollar with space after opening $", () => {
        expect(escapeFalseLatex("all $ figures by $500k")).toBe("all \\$ figures by \\$500k");
    });

    it("escapes pair ending with operator -", () => {
        expect(escapeFalseLatex("$100K-$500K range")).toBe("\\$100K-\\$500K range");
    });

    // --- Uncertain (preserved as fallback) ---

    it("preserves uncertain content as fallback", () => {
        expect(escapeFalseLatex("$100 + 200$")).toBe("$100 + 200$");
    });

    // --- Code block protection ---

    it("preserves dollar signs inside inline code", () => {
        expect(escapeFalseLatex("use `$100 and $200` as values")).toBe("use `$100 and $200` as values");
    });

    it("preserves dollar signs inside fenced code blocks", () => {
        const input = "text\n```\nprice $100 and $200\n```\nmore";
        expect(escapeFalseLatex(input)).toBe(input);
    });

    it("escapes outside code but preserves inside", () => {
        const input = "costs $100M and $500M\n```\nprice = $200\n```";
        const expected = "costs \\$100M and \\$500M\n```\nprice = $200\n```";
        expect(escapeFalseLatex(input)).toBe(expected);
    });

    // --- Edge cases ---

    it("returns empty string unchanged", () => {
        expect(escapeFalseLatex("")).toBe("");
    });

    it("returns string with no dollar signs unchanged", () => {
        expect(escapeFalseLatex("no dollars here")).toBe("no dollars here");
    });

    it("does not double-escape already escaped \\$", () => {
        expect(escapeFalseLatex("costs \\$100")).toBe("costs \\$100");
    });

    it("handles interleaved currency and real latex on same line", () => {
        // $ positions: $500M, $sales (open), $ (close latex), $15M
        // Pass 1 commits $sales = x*e^{y}$ as LaTeX (has braces)
        // Pass 2: $500M has committed pair between it and next unpaired → escape
        //         $15M is lone (no closing $) → remark-math can't pair it → safe as-is
        const input = "The report for $500M shows that (given a formula $sales = x*e^{y}$) we were off by nearly $15M in 2025.";
        const expected = "The report for \\$500M shows that (given a formula $sales = x*e^{y}$) we were off by nearly $15M in 2025.";
        expect(escapeFalseLatex(input)).toBe(expected);
    });

    it("handles odd number of currency $ before real latex", () => {
        // positions: $500M, $x (opening), $ (closing of LaTeX)
        // Pass 1 commits $x = \frac{1}{2}$ as LaTeX
        // Pass 2: $500M has committed pair after it → escape
        const input = "costs $500M. Also $x = \\frac{1}{2}$ works";
        const expected = "costs \\$500M. Also $x = \\frac{1}{2}$ works";
        expect(escapeFalseLatex(input)).toBe(expected);
    });

    it("handles real latex on its own line after false latex", () => {
        const input = "between $100M and $500M\nwhere $x = \\frac{1}{2}$";
        // Pair 1: $100M and $ → ends with space → escape
        // $500M has no pair on same line (newline breaks it)
        // Pair 2: $x = \frac{1}{2}$ → has \frac → preserve
        const expected = "between \\$100M and \\$500M\nwhere $x = \\frac{1}{2}$";
        expect(escapeFalseLatex(input)).toBe(expected);
    });

    it("handles the full user input scenario", () => {
        const input = "Make me a report from the documents to determine if sales are between $100M and $500M";
        const expected = "Make me a report from the documents to determine if sales are between \\$100M and \\$500M";
        expect(escapeFalseLatex(input)).toBe(expected);
    });

    it("handles the dollar figures scenario", () => {
        const input = "make the $ figures represented more reasonable (decrease all $ figures by 500k)";
        const expected = "make the \\$ figures represented more reasonable (decrease all \\$ figures by 500k)";
        expect(escapeFalseLatex(input)).toBe(expected);
    });

    // --- Single letter variables and simple assignments ---

    it("preserves single letter variable $r$", () => {
        expect(escapeFalseLatex("growth rate $r$ can be expressed")).toBe("growth rate $r$ can be expressed");
    });

    it("preserves single letter variable $t$", () => {
        expect(escapeFalseLatex("and $t$ is years")).toBe("and $t$ is years");
    });

    it("preserves variable assignment $r = 0.235$", () => {
        expect(escapeFalseLatex("where $r = 0.235$ (growth rate)")).toBe("where $r = 0.235$ (growth rate)");
    });

    it("preserves variable assignment $n = 4$", () => {
        expect(escapeFalseLatex("$n = 4$ (quarters per year)")).toBe("$n = 4$ (quarters per year)");
    });

    it("preserves LaTeX with \\% command", () => {
        expect(escapeFalseLatex("we achieved $r = 23.5\\%$ growth")).toBe("we achieved $r = 23.5\\%$ growth");
    });

    it("preserves LaTeX with \\$ inside math", () => {
        expect(escapeFalseLatex("where $P = \\$2,847,500$ is the amount")).toBe("where $P = \\$2,847,500$ is the amount");
    });

    it("preserves variable assignment $d = 0.15$", () => {
        expect(escapeFalseLatex("with rate $d = 0.15$:")).toBe("with rate $d = 0.15$:");
    });

    // --- Financial report mixed patterns (from example.md) ---

    it("handles currency followed by single-letter LaTeX variable", () => {
        const input = "Product Line A generated $1,234,567 in revenue with an average transaction value of $156.78. The revenue growth rate $r$ can be expressed as:";
        const result = escapeFalseLatex(input);
        expect(result).toContain("$r$");
        expect(result).toContain("\\$1,234,567");
        expect(result).toContain("\\$156.78");
    });

    it("handles line with currency and LaTeX \\% command", () => {
        const input = "Using this formula, we achieved $r = 23.5\\%$ growth. Marketing spent $387,900, yielding a customer acquisition cost (CAC) of $45.23 per customer.";
        const result = escapeFalseLatex(input);
        expect(result).toContain("$r = 23.5\\%$");
        expect(result).toContain("\\$387,900");
        expect(result).toContain("\\$45.23");
    });

    it("handles line with \\$ inside LaTeX and currency amounts", () => {
        const input = "Where $P = \\$2,847,500$ (initial quarterly revenue), $r = 0.235$ (growth rate), $n = 4$ (quarters per year), and $t$ is years.";
        const result = escapeFalseLatex(input);
        expect(result).toContain("$P = \\$2,847,500$");
        expect(result).toContain("$r = 0.235$");
        expect(result).toContain("$n = 4$");
        expect(result).toContain("$t$");
    });

    it("handles profitability ratio line with mixed currency and LaTeX fractions", () => {
        const input = "- Net Margin after $178,450 in taxes: $\\frac{\\$1,023,820}{\\$2,847,500} = 36.0\\%$";
        const result = escapeFalseLatex(input);
        expect(result).toContain("\\$178,450");
        expect(result).toContain("$\\frac{\\$1,023,820}{\\$2,847,500} = 36.0\\%$");
    });

    it("handles complex mixed input with inline latex, display math, and multiple currency patterns", () => {
        const input = "The report for $500M shows that (given a formula $sales = x*e^{y}$) we were off by nearly $15M in 2025. Final sales showed that true estimates should have been closer to $515M in raw $ ammounts, +/- $5M to $ 7.5M. This is derived from the overall equation $$variance = x*v/2*e^(y-y`)$$";
        const result = escapeFalseLatex(input);

        // Inline LaTeX preserved
        expect(result).toContain("$sales = x*e^{y}$");
        // Display math preserved
        expect(result).toContain("$$variance = x*v/2*e^(y-y`)$$");
        // Currency $ escaped where they would form false-latex pairs
        expect(result).toContain("\\$500M");
        expect(result).toContain("\\$515M");
        expect(result).toContain("\\$ ammounts");
        expect(result).toContain("\\$5M");
        // Lone $ signs that can't pair are harmless — remark-math ignores them
        // $15M and $ 7.5M end up as lone unpaired $ after LaTeX pairs are committed
    });
});
