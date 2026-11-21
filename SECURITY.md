# Security policy

LernLab opens deck files that people share with each other, and it can let an AI assistant read your
cards. A malicious deck or a misbehaving assistant is a real risk, so we take reports seriously and
fix them first.

## Report a vulnerability privately

**Don't open a public issue.** Use GitHub's private form instead:
[Report a vulnerability](https://github.com/n1m5l5ss/lernlab/security/advisories/new)
(also on the **Security** tab → **Report a vulnerability**). Only the maintainers in
[MAINTAINERS.md](MAINTAINERS.md) can see it.

Please include:

- what you found and which version (Settings → About);
- how to reproduce it: an example deck file, steps or a short script helps a lot;
- what an attacker could do with it.

You don't need a fix, a CVE or perfect English. A rough report is better than none.

## What happens next

| When | What we do |
|---|---|
| Within 7 days | Confirm we got your report and tell you who is looking at it. |
| Within 14 days | Tell you whether we consider it a vulnerability and how serious it is. |
| Within 90 days | Release a fix, then publish a GitHub security advisory (with a CVE where it applies). |

We keep you updated, agree the publication date with you, and credit you in the advisory and the
changelog unless you'd rather stay anonymous. If a fix needs longer than 90 days, we'll explain why.

**If nobody answers within 14 days**, open a public issue that says only "I reported a security
problem privately and haven't heard back", with no details. The reminder workflow and
[GOVERNANCE.md](GOVERNANCE.md) make sure someone on the team picks it up.

## Supported versions

| Version | Security fixes |
|---|---|
| Latest 1.x release | Yes |
| Older 1.x releases | No, please update (LernLab checks for updates by itself) |
| 0.x prototypes | No |

## What counts

In scope, for example:

- a deck file (`.lernpack`, Anki `.apkg`, CSV, JSON) that runs code, reads or writes files outside
  LernLab's data folder, or crashes or freezes the app in a way a user can't recover from;
- HTML or script in a card that runs inside the app;
- the AI assistant connection (the MCP plugin) changing your data without your approval, working
  while it's turned off, or being reachable by another program or website;
- anything that sends your data off your computer without you asking (LernLab only goes online to
  check for updates and to open the deck gallery when you ask);
- the update check or installers being tampered with, or our CI leaking a secret or publishing
  something nobody approved.

Not in scope:

- the warning macOS and Windows show because installers aren't signed yet
  ([docs/CODE_SIGNING.md](docs/CODE_SIGNING.md));
- someone who already controls your user account or your computer;
- what an AI assistant you connected does with the cards it was allowed to read;
- missing "best practice" headers or settings without a way to exploit them (open a normal issue).

## Safe harbour

Research done in good faith on your own copy of LernLab is welcome. Don't access other people's
data, and give us a chance to fix the problem before you publish it. We won't take legal action
against anyone who follows this policy.

## How we keep LernLab safe

Automatic checks (CodeQL, Dependabot, OpenSSF Scorecard, fuzz tests of the importers, pinned CI) and
the settings maintainers keep on are listed in
[docs/SECURITY-PRACTICES.md](docs/SECURITY-PRACTICES.md).
