# Prime Auto Care 2.15.0

Full operational handover: see `../../AI_HANDOVER/RELEASE_2.15.0.md`.

Highlights:
- 15-second lightweight cloud revision checks instead of repeatedly downloading the full workspace payload; full snapshot reads occur only after `updated_at` changes.
- Vehicle model replaces Odometer; invoices support multiple assigned staff, Paid/Pending/date filters, and today's collection/outstanding summaries.
- Public booking requests show a large Pending confirmation modal; both browser and booking API guards reduce accidental duplicate requests.
- Accept/reject handoff prepares a customer PDF and WhatsApp message. Completing a booking creates/links its customer and vehicle, invoice and payment record before status completion.
- Vehicle-specific paid-visit loyalty; four paid visits qualify the fifth visit for an optional free service, with an Enable/Disable switch per vehicle.
- Daily staff Time In/Out, Lunch Start/End, overtime hours/bonus, payroll inclusion and advanced staff PDF.

## Integration caveats
- Full closed-app Android push is not considered enabled until Firebase Cloud Messaging configuration, device token registration, server sender credentials and physical-device testing are complete.
- Automatic WhatsApp sending is not active until Meta Cloud API sender credentials and approved message templates are configured. Current flows prepare the PDF and message for the user to review and send.

No business database reset or canonical workspace owner ID change is included. Preserve the existing cloud snapshot key.
