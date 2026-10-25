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
| 9 | pr | Shire Systems Pirana CMMS | Shire Systems Ltd | UK CMMS with a mobile app for engineers | Now ShireSystem Mobile PRO by Elecosoft; A10 primary; Play data gives Android 4.1 minimum, phone layout only |
| 10 | pr | Infraspeak | Infraspeak | Maintenance and FM platform with Android app; NFC asset tags | A10 primary; Infraspeak Academy gives Android 10 minimum, 4GB RAM, recommended Android 13 and 6GB |
| 11 | pr | Zuper | Zuper | Field service management with an Android app; HVAC and FM | A8 primary; docs.zuper.co Device Requirements gives Android 8.0 minimum |
| 12 | skip | Salesforce Field Service | Salesforce | Enterprise field service mobile app with published Android requirements | Salesforce requires Android 15 (latest major minus two) and 5GB RAM minimum (October 2026); no Tuga Android device meets it. Revisit when the range changes |
| 13 | pr | Oracle Field Service | Oracle | Enterprise field service with a published mobile requirements page | A10 primary; Oracle guide F75117-19 (September 2026) gives Android 7 or later |
| 14 | pr | ServiceNow Field Service Management | ServiceNow | Enterprise FSM with the Now Mobile app; published device requirements | A10 primary; ServiceNow Zurich tested-devices page gives Android 12 minimum, 8GB RAM recommended; the app is ServiceNow Agent |
| 15 | pr | FieldPulse | FieldPulse | Field service app for trades with an Android app; UK presence | A8 primary; help centre gives Android 7.0 through latest; Play lists a phone layout only; no UK presence found |
| 16 | skip | Buildertrend | Buildertrend | Construction project management with an Android app | No clear published Android floor: the help article says no Android version before 7.9.9, which reads as an app version, and the Play listing shows no Requires Android figure |
