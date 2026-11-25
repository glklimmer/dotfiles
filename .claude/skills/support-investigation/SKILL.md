---
name: support-investigation
description: Investigate a #support Slack thread or Zendesk ticket about a practice instance: read the thread and its screenshots, trace the code path, check the instance's data read-only, prove the cause and draft the reply. Load when given a #support Slack link or asked to investigate a support request.
---

# Support investigation

1. **Read the thread** with `slack_read_thread` (`p1700000000123456` → ts `1700000000.123456`) and every attached image with `slack_read_file`.
2. **Trace the code path** behind the reported behaviour on `origin/master`, from the UI element the practice names down to the query or validation that decides it.
3. **Check the instance's data, read-only**: write a report script to the scratchpad and run it with `script/pan.do rails:collect <script> <instance>`. Say in one line what it reads and why before running it. Ask before any write.
   - No personal data in the output: print ids, counts, element and column names, never filenames, names, addresses or field values; mask quoted values in library error messages.
   - Count every error or match; never report the first few as the total.
4. **Prove the cause** before stating it. Name which kind it is:
   - **Someone changed data**: the audit trail (who changed what, when); the code condition that change breaks; the live record with the change undone in memory (never `save`), the condition re-evaluated, usage compared before and after.
   - **A faulty input** (uploaded or imported file): the path from upload to storage keeps the bytes unchanged; where the faulty values sit and whose data they are; none exist in the instance's own data; with only those values fixed in memory, the input passes.
   - **A bug in our code**: the failing condition reproduced on the live record; a workaround support can use now; the other affected instances, found with `rails:collect` across instances.

   Say what the data cannot show, such as why someone made the change. When only the practice knows, the reply asks support to find out before anything changes.
5. **Draft the reply** to the support person who opened the ticket (@mention them). They talk to the practice; we never reach labs or other third parties, and the fix is a step support or the practice can take, or an offer to do it ourselves.
   - First line: the verdict ("Not a ZAK outage and no change on our side.", "this is a bug.") or the question support has to ask the practice.
   - Then "What's wrong" and "Fix" with concrete objects and dates (17.11), the step, not tool instructions. For a bug: the workaround, the affected instances, the MR link once there is one. After a data fix: "done.", what changed, what existing records keep, what's left.
   - A table in a code block only for a timeline of individual changes; never to repeat the text.
   - One idea per paragraph, no intro, no cross-references to other tickets, no justification of alternatives, no proof section. Hedge what isn't proven ("probably", "seems").
   - Literal characters, codes and field names in inline code, so Slack keeps them. Straight quotes.

   Iterate on the text in chat; after a yes, save it once with `slack_send_message_draft` in the thread (Slack keeps one draft per channel and the tool can't edit it).
