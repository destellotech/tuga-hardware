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
| 1 | pr | Powered Now | Powered Now Ltd | UK field service app for plumbers, electricians and builders; quoting, certificates, invoicing | A10 primary; Android 14 minimum per the Powered Now support article |
| 2 | pr | WorkPal | Workpal Ltd (Northern Ireland) | UK and Ireland job management for field teams, strong in FM and maintenance | A8 primary; Play listing declares Android 11 (API 30) |
| 3 | pr | Clik Service | Clik Ltd | UK service management with the Clik Jobs mobile app; HVAC, fire and security | A8 primary; Play listing Android 5.0, app last updated July 2024, Clik now part of Joblogic |
| 4 | skip | Protean Software | Protean Software Ltd | UK field service and asset management; HVAC, lifts, fire, access | Only a 2016 spec is published (Android 4.4) and the engineer app was not found on Google Play; revisit when Joblogic publishes current requirements |
| 5 | pr | Synchroteam | Synchroteam | Field service management with an Android app; used by UK SMEs | A10 primary; help centre says Android 12 or later (September 2025) |
| 6 | skip | Castle Field Service | Castle Computer Services | UK field service software for engineers; maintenance and compliance | No such product: Castle Computer Services is an accounting and IT firm acquired by Kick ICT in 2018; no field service app exists |
| 7 | pr | Re-flow | Re-flow Ltd | UK construction and civils field management; forms, timesheets, plant | A8 primary; vendor FAQ gives Android 7 minimum, 8 recommended, GPS and camera required |
| 8 | pr | GoCanvas | GoCanvas | Mobile forms and inspections used by UK trades; Android app | A10 primary; help centre says Android 13 and higher (October 2026) |
| 9 | todo | Shire Systems Pirana CMMS | Shire Systems Ltd | UK CMMS with a mobile app for engineers | |
| 10 | todo | Infraspeak | Infraspeak | Maintenance and FM platform with Android app; NFC asset tags | |
| 11 | todo | Zuper | Zuper | Field service management with an Android app; HVAC and FM | |
| 12 | todo | Salesforce Field Service | Salesforce | Enterprise field service mobile app with published Android requirements | |
| 13 | todo | Oracle Field Service | Oracle | Enterprise field service with a published mobile requirements page | |
| 14 | todo | ServiceNow Field Service Management | ServiceNow | Enterprise FSM with the Now Mobile app; published device requirements | |
| 15 | todo | FieldPulse | FieldPulse | Field service app for trades with an Android app; UK presence | |
| 16 | todo | Buildertrend | Buildertrend | Construction project management with an Android app | |
