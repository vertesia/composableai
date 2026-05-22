#!/usr/bin/env python3
"""Generate realistic Markdown seed documents for Vertesia demos."""

from __future__ import annotations

import argparse
from pathlib import Path


Sample = dict[str, str]


SAMPLES: dict[str, list[Sample]] = {
    "generic": [
        {
            "slug": "acme-business-review",
            "title": "Acme Business Review",
            "category": "Customer Review",
            "owner": "Customer Success",
            "status": "In Review",
            "date": "2026-05-15",
            "summary": "Quarterly account review covering adoption, risks, renewal outlook, and executive follow-ups.",
            "details": "Acme expanded usage across three departments. The main open risk is delayed security questionnaire completion before renewal.",
            "actions": "Schedule executive sponsor meeting; complete security questionnaire; prepare renewal pricing proposal.",
        },
        {
            "slug": "northstar-implementation-plan",
            "title": "Northstar Implementation Plan",
            "category": "Project Plan",
            "owner": "Professional Services",
            "status": "Active",
            "date": "2026-06-01",
            "summary": "Implementation plan for a phased rollout with data migration, training, acceptance criteria, and launch support.",
            "details": "Phase one covers workspace setup and identity configuration. Phase two covers content migration and automation testing.",
            "actions": "Confirm migration sample set; validate SSO; schedule administrator training.",
        },
        {
            "slug": "globex-risk-memo",
            "title": "Globex Risk Review Memo",
            "category": "Risk Memo",
            "owner": "Operations",
            "status": "Escalated",
            "date": "2026-05-22",
            "summary": "Operational risk memo documenting supplier delay, customer impact, mitigation plan, and approval needs.",
            "details": "Supplier lead time increased from four weeks to nine weeks. Customer launch impact is likely unless substitute inventory is approved.",
            "actions": "Approve substitute supplier; notify account team; update delivery forecast.",
        },
    ],
    "clm": [
        {
            "slug": "acme-enterprise-saas-agreement",
            "title": "Acme Enterprise SaaS Agreement",
            "category": "Customer MSA",
            "owner": "Sales Ops",
            "status": "In Review",
            "date": "2026-05-15",
            "summary": "Enterprise subscription agreement with negotiated liability, data processing, uptime SLA, and renewal terms.",
            "details": "Counterparty: Acme Corp. Value: $425,000 USD. Risk: High. Expiration: 2026-11-30. Renewal notice: 2026-08-01.",
            "actions": "Finance review for contract value; legal review for liability carveouts; security review for data processing exhibit.",
        },
        {
            "slug": "northstar-vendor-services",
            "title": "Northstar Vendor Services Agreement",
            "category": "Vendor Agreement",
            "owner": "Procurement",
            "status": "Active",
            "date": "2026-02-01",
            "summary": "Managed services agreement with quarterly service reviews, payment milestones, and vendor performance obligations.",
            "details": "Counterparty: Northstar Services. Value: $98,000 USD. Risk: Medium. Expiration: 2026-07-15. Renewal notice: 2026-04-16.",
            "actions": "Track monthly service report; review SLA performance; prepare renewal recommendation.",
        },
        {
            "slug": "globex-channel-partner-addendum",
            "title": "Globex Channel Partner Addendum",
            "category": "Partner Amendment",
            "owner": "Partner Sales",
            "status": "Renewal Pending",
            "date": "2026-04-01",
            "summary": "Channel amendment with non-standard exclusivity, revenue-share commitments, and accelerated renewal decision timing.",
            "details": "Counterparty: Globex. Value: $720,000 USD. Risk: Critical. Expiration: 2026-06-30. Renewal notice: 2026-05-15.",
            "actions": "Executive review for exclusivity; legal review for territory language; renewal decision by notice date.",
        },
    ],
    "support": [
        {
            "slug": "acme-login-incident",
            "title": "Acme Login Incident",
            "category": "Support Case",
            "owner": "Support Engineering",
            "status": "Open",
            "date": "2026-05-03",
            "summary": "Priority support case for intermittent login failures affecting Acme administrators.",
            "details": "Severity: High. Product area: Authentication. Error rate increased after SSO certificate rotation.",
            "actions": "Validate IdP metadata; rotate cached certificate; provide customer incident summary.",
        },
        {
            "slug": "northstar-export-request",
            "title": "Northstar Export Performance Request",
            "category": "Support Case",
            "owner": "Customer Support",
            "status": "Pending Customer",
            "date": "2026-05-07",
            "summary": "Customer reports slow exports for large document collections during month-end reporting.",
            "details": "Severity: Medium. Product area: Reporting. Export size exceeds 50,000 rows.",
            "actions": "Request sample export parameters; propose async export workflow; monitor next month-end run.",
        },
        {
            "slug": "globex-api-rate-limit",
            "title": "Globex API Rate Limit Review",
            "category": "Support Case",
            "owner": "Developer Support",
            "status": "Escalated",
            "date": "2026-05-10",
            "summary": "Integration is hitting API rate limits during nightly synchronization.",
            "details": "Severity: High. Product area: API. Current client retries aggressively without backoff.",
            "actions": "Share retry guidance; evaluate rate limit increase; review integration logs.",
        },
    ],
    "policy": [
        {
            "slug": "data-retention-policy",
            "title": "Data Retention Policy",
            "category": "Policy",
            "owner": "Compliance",
            "status": "Approved",
            "date": "2026-01-01",
            "summary": "Policy defining retention periods, archival requirements, deletion approvals, and exception handling.",
            "details": "Customer records are retained for seven years unless a shorter contractual retention period applies.",
            "actions": "Review exceptions quarterly; confirm deletion audit trail; update retention schedule annually.",
        },
        {
            "slug": "vendor-onboarding-procedure",
            "title": "Vendor Onboarding Procedure",
            "category": "Procedure",
            "owner": "Procurement",
            "status": "Active",
            "date": "2026-03-01",
            "summary": "Procedure for onboarding vendors with security review, contract approval, tax setup, and performance tracking.",
            "details": "Critical vendors require security approval before contract execution and annual reassessment.",
            "actions": "Collect W-9; complete security questionnaire; create vendor performance record.",
        },
        {
            "slug": "incident-response-standard",
            "title": "Incident Response Standard",
            "category": "Standard",
            "owner": "Security",
            "status": "In Review",
            "date": "2026-04-15",
            "summary": "Operational standard for detecting, triaging, communicating, and resolving security incidents.",
            "details": "Critical incidents require executive notification within one hour and customer notification review within twenty-four hours.",
            "actions": "Validate escalation matrix; run tabletop exercise; update postmortem template.",
        },
    ],
}


def render(sample: Sample, domain: str) -> str:
    return f"""# {sample['title']}

## Metadata

- Domain: {domain}
- Category: {sample['category']}
- Owner: {sample['owner']}
- Status: {sample['status']}
- Record Date: {sample['date']}

## Summary

{sample['summary']}

## Details

{sample['details']}

## Actions

{sample['actions']}

## Extraction Hints

This document is suitable for testing Vertesia upload, full-text search, metadata filters, AI summarization, metadata extraction, workflow routing, and object detail views.
"""


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate Markdown seed documents for Vertesia demos.")
    parser.add_argument("--out", required=True, help="Output directory.")
    parser.add_argument("--domain", choices=sorted(SAMPLES), default="generic", help="Built-in sample domain.")
    parser.add_argument("--count", type=int, default=3, help="Number of documents to generate.")
    args = parser.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    samples = SAMPLES[args.domain]
    count = max(1, min(args.count, len(samples)))
    for sample in samples[:count]:
        path = out / f"{sample['slug']}.md"
        path.write_text(render(sample, args.domain), encoding="utf-8")
        print(path)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
