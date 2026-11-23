---
name: support-investigation
description: Investigate a #support Slack thread or Zendesk ticket about a practice instance: read the thread and its screenshots, trace the code path, check the instance's data read-only, prove the cause and draft the reply. Load when given a #support Slack link or asked to investigate a support request.
---

# Support investigation

1. **Read the thread** with `slack_read_thread` (`p1700000000123456` → ts `1700000000.123456`) and every attached image with `slack_read_file`.
2. **Trace the code path** behind the reported behaviour on `origin/master`, from the UI element the practice names down to the query or validation that decides it.
3. **Check the instance's data, read-only**, with the repo's ops tooling. Ask before any write.
4. **Prove the cause** before stating it, with all three:
   - the audit trail: who changed what, when;
   - the code condition that change breaks;
   - the live record: undo the suspected change in memory (never `save`), re-evaluate the condition, and compare usage before and after the change.

   Say what the data cannot show, such as why someone made the change.
5. **Draft the reply** for the thread: what changed, the evidence (a change table in a code block), the fix. Short paragraphs with blank lines, straight quotes, no side explanations. Never post it; after a yes, save it with `slack_send_message_draft` in the thread.
