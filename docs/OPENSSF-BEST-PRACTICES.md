# OpenSSF Best Practices badge: our answers

The [OpenSSF Best Practices badge](https://www.bestpractices.dev) is a free self-assessment for open-source
projects. A maintainer signs in with GitHub at <https://www.bestpractices.dev/en/projects/new>, adds
`https://github.com/n1m5l5ss/lernlab`, and answers the questions. The site fills in many answers by itself.
This page lists the evidence for each "passing" criterion, so anyone on the team can fill in or update the form.
Once the project has an id, add its badge next to the others in the README.

## Basics

| Criterion | Answer | Evidence |
|---|---|---|
| Describe what the software does | Met | [README.md](../README.md) |
| How to get, give feedback and contribute | Met | README, [CONTRIBUTING.md](../CONTRIBUTING.md), issue forms in `.github/ISSUE_TEMPLATE/` |
| Contribution requirements (coding standards) | Met | CONTRIBUTING.md, [CLAUDE.md](../CLAUDE.md) "Rules" |
| FLOSS licence, posted in a standard place | Met | MIT, [LICENSE](../LICENSE) |
| Documentation of what it does and its interface | Met | [USER-GUIDE.md](USER-GUIDE.md), [FORMAT.md](FORMAT.md), [ARCHITECTURE.md](ARCHITECTURE.md) |
| HTTPS project sites | Met | GitHub and GitHub Pages |
| Discussion mechanism, searchable, by URL | Met | GitHub Issues and Discussions |
| Documentation in English | Met | All docs |
| Maintained | Met | See commit history and [MAINTAINERS.md](../MAINTAINERS.md) |

## Change control

| Criterion | Answer | Evidence |
|---|---|---|
| Public version-controlled repository with interim versions | Met | GitHub, `dev` and `main` branches |
| Unique version numbers, SemVer | Met | release-please, [RELEASING.md](RELEASING.md) |
| Release notes for each release, including fixed vulnerabilities | Met | [CHANGELOG.md](../CHANGELOG.md), GitHub Releases; advisories linked from the changelog |

## Reporting

| Criterion | Answer | Evidence |
|---|---|---|
| Bug-reporting process, issue tracker | Met | Issue forms, GitHub Issues |
| Acknowledge most bug reports within 14 days | Met | `reminder.yml` nudges maintainers after 7 days ([GOVERNANCE.md](../GOVERNANCE.md)) |
| Vulnerability reporting process, private reports | Met | [SECURITY.md](../SECURITY.md), GitHub private vulnerability reporting |
| Initial response to vulnerability reports within 14 days | Met | SECURITY.md promises 7 days |

## Quality

| Criterion | Answer | Evidence |
|---|---|---|
| Working build system, using common tools | Met | npm workspaces, Vite, electron-builder |
| Automated test suite, documented how to run | Met | `npm test`, [TESTING.md](TESTING.md) |
| Tests added for new functionality, policy documented | Met | CLAUDE.md "test first", PR template |
| Compiler warnings / linter | Met | strict TypeScript, ESLint in CI |
| Continuous integration | Met | `ci.yml` on Windows, macOS and Linux |

## Security

| Criterion | Answer | Evidence |
|---|---|---|
| A developer who knows secure design | Met | [SECURITY-PRACTICES.md](SECURITY-PRACTICES.md), Electron checklist |
| Uses only standard, published crypto; no own crypto | Met (N/A) | LernLab doesn't implement cryptography; SHA-1 in `packages/core/src/sha1.ts` is only for stable ids and Anki checksums, not security |
| Delivery protected against MITM (HTTPS) | Met | GitHub Releases over HTTPS; build provenance attestations |
| No unpatched medium+ vulnerabilities public for more than 60 days | Met | Dependabot, `npm audit --audit-level=high` in CI |
| No leaked credentials in the repo | Met | Secret scanning and push protection |

## Analysis

| Criterion | Answer | Evidence |
|---|---|---|
| Static analysis on every release | Met | CodeQL on every pull request and weekly, ESLint |
| Address medium+ issues from static analysis | Met | CodeQL alerts show on the pull request and under Security → Code scanning; fixed before merging |
| Dynamic analysis | Met | Fuzz tests (`packages/core/test/fuzz.test.ts`, nightly `fuzz.yml`), end-to-end tests |
