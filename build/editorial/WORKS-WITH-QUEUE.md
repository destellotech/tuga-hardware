# Works-with queue

One software page a week, written by a scheduled cloud agent (prompt in
`WORKS-WITH-ROUTINE.md`) the same way the blog calendar works. The agent
takes the **first row with status `todo`**, researches what the vendor
publishes about device requirements, writes
`build/content/works-with/<slug>.json`, opens a PR and sets the row to `pr`.
When the PR is merged the row counts as published. Reorder, edit or delete
rows freely; set a row to `skip` to veto it.

Rules the agent follows before a row becomes a page:

- The vendor must publish device requirements somewhere citable (a help
  centre article, a Google Play listing, a Microsoft Store page). No source,
  no page: the row is set to `skip` with the reason in the Notes column.
- Only the Tuga A10, A8, W10 and A6 can be recommended; the build ignores
  any other id. Nothing is ever described as tested or certified on a Tuga
  device; the page matches published requirements to published specs.
- When fewer than three `todo` rows remain, the agent appends six more
  candidates it has checked for a published requirements page, so the
  founder reviews the topics in the same PR as that week's page.

Status: `todo` → `pr` → `done` (or `skip`).

| # | Status | Software | Vendor | Why | Notes |
|---|--------|----------|--------|-----|-------|
| 1 | todo | Powered Now | Powered Now Ltd | UK field service app for plumbers, electricians and builders; quoting, certificates, invoicing | |
| 2 | todo | WorkPal | Workpal Ltd (Northern Ireland) | UK and Ireland job management for field teams, strong in FM and maintenance | |
| 3 | todo | Clik Service | Clik Ltd | UK service management with the Clik Jobs mobile app; HVAC, fire and security | |
| 4 | todo | Protean Software | Protean Software Ltd | UK field service and asset management; HVAC, lifts, fire, access | |
| 5 | todo | Synchroteam | Synchroteam | Field service management with an Android app; used by UK SMEs | |
| 6 | todo | Castle Field Service | Castle Computer Services | UK field service software for engineers; maintenance and compliance | |
| 7 | todo | Re-flow | Re-flow Ltd | UK construction and civils field management; forms, timesheets, plant | |
| 8 | todo | GoCanvas | GoCanvas | Mobile forms and inspections used by UK trades; Android app | |
| 9 | todo | Shire Systems Pirana CMMS | Shire Systems Ltd | UK CMMS with a mobile app for engineers | |
| 10 | todo | Infraspeak | Infraspeak | Maintenance and FM platform with Android app; NFC asset tags | |
| 11 | todo | Zuper | Zuper | Field service management with an Android app; HVAC and FM | |
| 12 | todo | Salesforce Field Service | Salesforce | Enterprise field service mobile app with published Android requirements | |
| 13 | todo | Oracle Field Service | Oracle | Enterprise field service with a published mobile requirements page | |
| 14 | todo | ServiceNow Field Service Management | ServiceNow | Enterprise FSM with the Now Mobile app; published device requirements | |
| 15 | todo | FieldPulse | FieldPulse | Field service app for trades with an Android app; UK presence | |
| 16 | todo | Buildertrend | Buildertrend | Construction project management with an Android app | |
