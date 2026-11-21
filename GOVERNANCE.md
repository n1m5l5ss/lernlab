# How LernLab is run

LernLab is meant to outlive any one person, including its founder. This page explains who can do what, how to join, how decisions are made, and how the project keeps going if someone, the lead included, stops answering. It covers both repositories: [lernlab](https://github.com/n1m5l5ss/lernlab) (the app) and [lernlab-decks](https://github.com/n1m5l5ss/lernlab-decks) (the deck gallery).

## Roles

| Role | What they can do | How you get it |
|---|---|---|
| **Contributor** | Anyone who reports a bug, sends a deck, translates or opens a pull request | Just start |
| **Reviewer** | Reviews and approves pull requests and deck submissions. An approval from a reviewer counts toward the one approval a change needs. | Ask with the form below; one maintainer says yes |
| **Maintainer** | Everything a reviewer does, plus merging, releasing, labelling and closing, and saying yes to new reviewers | Ask with the form below; one maintainer says yes, and nobody on the team objects within 7 days |
| **Lead** | The final say when the team can't agree, owns the repositories and adds or removes maintainers | See [Taking over as lead](#taking-over-as-lead) |

Everyone on the team is listed in [MAINTAINERS.md](MAINTAINERS.md). The same list is kept in both repositories.

## Join the team

**One place to apply:** the [Join the team form](https://github.com/n1m5l5ss/lernlab/issues/new?template=join_team.yml). Pick the role you'd like (reviewer, maintainer or lead), say a little about yourself and link to anything you've done for LernLab or elsewhere. You don't need to have contributed before to become a reviewer of decks. For code, a few helpful reviews or pull requests first make the answer easy.

What happens next:

1. Any maintainer answers on the issue. For a reviewer, one maintainer's yes is enough. For a maintainer, one yes plus 7 days without an objection from the team.
2. If nobody has answered after **7 days**, a bot labels the request `waiting-for-review` and mentions everyone in MAINTAINERS.md.
3. If nobody has answered after **30 days**, the request counts as accepted. Any maintainer or the lead adds the person and their name to MAINTAINERS.md. If no one with the rights to add people is left, follow [If the team goes quiet](#if-the-team-goes-quiet).

A request is only refused with a reason, given kindly on the issue.

## How decisions are made

- **Most changes:** one approval from a reviewer or maintainer, green checks, then a maintainer merges. A maintainer's own pull request also needs one approval from someone else.
- **Bigger questions** (a change to `docs/PLAN.md`, a new dependency, the principles in `CLAUDE.md`, this page): open an issue. If no maintainer objects within 7 days, it's agreed. If there is an objection, the maintainers vote, a simple majority wins, and the lead breaks a tie.
- Everyone follows the [Code of Conduct](CODE_OF_CONDUCT.md). Maintainers can remove someone who breaks it, after a warning, unless the harm is serious.

## Stepping down

Anyone can step down at any time by saying so on an issue or by opening a pull request that moves their name to the "Past team" part of MAINTAINERS.md. Someone who has done nothing in the project for 12 months is moved there too, with thanks, and can come back by asking again.

## Taking over as lead

The founder has said plainly that anyone who cares for the project may take over as lead. There are two ways:

1. **Handed over.** The lead names a successor, or someone asks with the Join the team form and picks "lead". The current lead and the maintainers discuss it on the issue. If the current lead doesn't answer within **30 days** (with the reminders above), the request counts as accepted, as long as no other maintainer objects.
2. **The lead steps down** and the maintainers choose the next lead by simple majority.

How ownership actually moves on GitHub:

- **Best: an organisation.** The repositories move to a free GitHub organisation (for example `lernlab`) with at least two owners. Then any owner can add people and no single person can block the project. The current lead does this with *Settings → General → Danger zone → Transfer ownership* for each repository. GitHub redirects the old addresses to the new ones.
- **Directly to the new lead:** the same *Transfer ownership* step, to the new lead's account.
- **The lead's backup:** every lead sets a [successor](https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-access-to-your-personal-account/maintaining-ownership-continuity-of-your-personal-accounts-repositories) in their GitHub account settings (look for *Successor settings*). If something happens to them, GitHub can pass the repositories to that person.

After a handover, the new lead updates MAINTAINERS.md, the update and gallery addresses if the repositories moved, and the website.

## If the team goes quiet

If the lead and every maintainer have been silent for **60 days** after a request and its reminders, and nobody can be given rights on these repositories, the community doesn't have to wait:

- Everything here is open: the app is MIT, and the gallery decks are open licences. Anyone may copy the repositories (a fork) and carry on in a new GitHub organisation.
- The founder agrees in advance that such a continuation may keep the **LernLab** name, as long as it:
  - stays free, open source and true to the principles in `CLAUDE.md`;
  - keeps the copyright line in `LICENSE` (the MIT licence requires this of every copy anyway);
  - keeps the credit **"Originally created by kandru (aka n1m5l5ss)"** visible in its README and on the app's About screen (see [AUTHORS.md](AUTHORS.md)).
- A copy that drops the credit may still use the code under the MIT licence, but not the LernLab name.
- Anyone who still has access is asked to point this README to the new home.

## Changing this page

Like any bigger question: an issue or pull request, and 7 days without an objection from a maintainer, or a majority vote.
