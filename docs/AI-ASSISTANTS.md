# Connect your own AI assistant

LernLab has no built-in AI. Instead, you can let an AI assistant you already use talk to LernLab through the **Model Context Protocol (MCP)**, an open standard many AI apps support. The assistant uses your own subscription and your own instructions; LernLab keeps no prompts and sends nothing anywhere.

Ask it things like:

- "How did my studying go this month? Which cards do I keep forgetting?"
- "Quiz me on ten of my hardest Spanish cards." (A quiz in the chat is never recorded and never changes when cards come back.)
- "What was my retention in October compared with September?"
- "Make Spanish cards from this PDF chapter." (The cards wait for you in LernLab under **AI requests**.)
- "Find duplicate cards in my biology deck and fix the typos." (Each merge and fix waits for you there too.)
- "Write two other ways to ask each of my hardest biology cards, and say why the wrong choices are wrong." (Each card's suggestions wait for you under **AI requests**, next to what the card has now.)
- "My German exam is on 1 March. Make me a plan." (It proposes an exam date, a goal and new cards a day for the deck.)

## Before you start: privacy

- **It is off until you turn it on.** In LernLab, open **Settings → AI assistant** and turn on **Let an AI assistant use LernLab**. While it is off, LernLab refuses every request from an assistant.
- **LernLab itself stays offline.** The assistant starts LernLab on your computer and talks to it directly (over "stdio"); nothing listens on the network.
- **What the assistant reads goes to its AI company.** Your decks, cards, answers and study history that the assistant reads are sent to the company that runs the assistant (for example Anthropic for Claude), under that company's privacy terms. Turn the switch off when you don't want that.
- **It cannot change or delete anything itself.** It opens your data read-only. What it proposes (new decks and cards, fixes, study aids for your cards, merges of duplicates, tags, stars, suspending or moving cards, goals, a study plan, an export) waits in LernLab under **AI requests**; nothing changes until you accept it there, and you can edit it first.
- **Shared decks can carry tricks.** A deck you downloaded or were sent can contain text written to fool an AI, such as "ignore your instructions and…". LernLab marks all card and deck text as third-party data, never instructions, and sends it as plain text only, but no assistant is perfect. Read each AI request before you accept it, and be careful when you connect an assistant that can also act elsewhere (send email, run commands) while it reads decks from strangers.

## Claude Desktop (verified setup)

Claude Desktop supports local MCP servers on macOS, Windows and Linux. The steps follow the official guide, [Connect to local MCP servers](https://modelcontextprotocol.io/docs/develop/connect-local-servers).

1. In LernLab, turn on **Settings → AI assistant**. Settings now shows the exact text for your computer; click **Copy**.
2. In Claude Desktop, open **Settings → Developer → Edit Config**. This opens `claude_desktop_config.json`:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`
3. Paste the text. If the file already has an `"mcpServers"` section, add only the `"lernlab"` entry inside it.
4. Quit Claude Desktop completely and open it again. LernLab appears under **Connectors**.

What the text looks like, by system (use the one Settings shows; your install folder may differ):

**macOS**

```json
{
  "mcpServers": {
    "lernlab": {
      "command": "/Applications/LernLab.app/Contents/MacOS/LernLab",
      "args": ["--mcp"]
    }
  }
}
```

**Windows** (the installer puts LernLab in your user folder)

```json
{
  "mcpServers": {
    "lernlab": {
      "command": "C:\\Users\\YOU\\AppData\\Local\\Programs\\LernLab\\LernLab.exe",
      "args": ["--mcp"]
    }
  }
}
```

**Linux** (the `.deb` package; for the AppImage, use the full path of your `.AppImage` file)

```json
{
  "mcpServers": {
    "lernlab": {
      "command": "/opt/LernLab/lernlab",
      "args": ["--mcp"]
    }
  }
}
```

LernLab does not need to be open: the assistant starts its own copy in the background (no window), which reads the same data. If something goes wrong, Claude Desktop writes LernLab's messages to `mcp-server-lernlab.log` in its logs folder (`~/Library/Logs/Claude` on macOS, `%APPDATA%\Claude\logs` on Windows, `~/.config/Claude/logs` on Linux).

## Other MCP apps

Any app that can start a local ("stdio") MCP server works the same way: the command is the LernLab program, the argument is `--mcp`. Use the command Settings shows.

### Hermes Agent

Hermes Agent's [MCP guide](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp) documents local stdio servers in `~/.hermes/config.yaml`, under `mcp_servers`:

```yaml
mcp_servers:
  lernlab:
    command: "/opt/LernLab/lernlab"
    args: ["--mcp"]
```

Hermes names the tools `mcp_lernlab_<tool>`; `tools.include` / `tools.exclude` limit which ones it may use.

### ChatGPT

- **ChatGPT desktop app:** OpenAI's [MCP page](https://learn.chatgpt.com/docs/extend/mcp) says the desktop app can connect to MCP servers directly: **Settings → MCP servers → add a server**, choose **STDIO**, and enter the command and the argument `--mcp`. Restart, then type `/mcp` to see it.
- **ChatGPT on the web** only uses remote MCP servers through plugins, so it cannot reach LernLab on your computer.

## What was checked, and what was not

Checked on 21 November 2026:

- LernLab's server, started with `--mcp` from the desktop app (not yet a packaged installer) on Linux, answered a real MCP client: it listed its tools and returned data. The automated tests start the server from the source code and talk to it the same way.
- The setup steps for Claude Desktop, Hermes Agent and the ChatGPT desktop app were read in each app's official documentation (linked above). They were **not** tried with those apps.

Not checked yet:

- The packaged installers (`.exe`, `.dmg`, `.deb`, `.AppImage`) started by an assistant, in particular on Windows and on macOS (where the system may ask for permission the first time).
- ChatGPT desktop: which plans and systems offer the **MCP servers** setting.
- Accepting an export in the packaged desktop app. It saves the file the same way as **Decks → Export**; the automated tests cover the request, not the save dialog.

## The tools

| Tool | What it gives the assistant |
|---|---|
| `get_overview` | Streak and freezes, today's sessions against your daily goal, total XP, the languages you study, your settings, and your last 10 mock exams (score, pass mark, score by topic) |
| `list_decks` | Every deck with its language, card counts, due and new cards today, goal and exam date |
| `get_due` | Cards due and new cards left today, in total and per deck |
| `search_cards` | Cards matching a text, tag or state (new, learning, known, suspended, starred) |
| `get_card` | One card in full: fields, tags, star, media, its choices and study aids (question variants, corrections, key points, what to learn first, memory aid, key terms), next due date and the chance you remember it now, and the exact wrong answers you gave |
| `get_stats` | Reviews, retention, answers and accuracy, minutes, sessions, cards learned, for today, a day, a week, a month, a year or all time |
| `get_session_history` | Your sessions: when, how long, and which modes and games |
| `get_weak_cards` | The cards you forget most, with accuracy and leech flags |
| `quiz_cards` | Cards for a quiz in the chat (nothing is recorded) |
| `propose_new_deck` | Proposes a new deck with cards (for example from a PDF or a link you gave it). It waits under **AI requests** |
| `propose_cards` | Proposes cards for one of your decks, each with optional prerequisites ("learn first"), a memory aid and key terms. They wait under **AI requests** |
| `propose_card_fix` | Proposes changes to one card (front, back, example, explanation, notes, category, tags) and study aids for it: other ways to ask the question, why each wrong choice is wrong, key points and a model explanation for an explain card, what to learn first, a memory aid, key terms. Its progress is kept |
| `propose_merge` | Proposes merging duplicates into one card. The others are suspended and tagged `merged`, never deleted |
| `propose_organise` | Proposes tagging, untagging, starring, unstarring, suspending, unsuspending or moving cards |
| `propose_goals` | Proposes a new daily goal (sessions a day) and new cards a day |
| `propose_study_plan` | Proposes a plan for one deck toward an exam: the exam date, a goal (cards to know by then) and new cards a day |
| `propose_export` | Proposes exporting a deck (CSV or LernLab pack). When you accept, LernLab asks where to save the file; the assistant never gets it |
| `list_requests` | The assistant's proposals that you haven't accepted or declined yet |

## AI requests

Everything the assistant proposes shows up in LernLab under **AI requests** in the sidebar, with its note on where it comes from. Edit the deck name or any card, untick what you don't want, then accept; or decline. Accepted cards start as new cards, and their text is cleaned like any imported deck.

A fix shows each field as it is now above the proposed text, which you can change. A merge shows the card to keep and its duplicates; the duplicates you leave ticked are suspended and tagged `merged` (find them in the card browser by that tag), never deleted. A tidy-up (tags, stars, suspending, moving) lists the cards it touches; untick any you want left alone. Fixed and merged cards keep their progress. Goals and a study plan show the values you have now next to the proposed ones, which you can change. An export asks you where to save the file, like **Decks → Export**. There are no tools to delete anything. At most 100 requests wait at once.

Mock exam results are worked out from the answers each exam recorded. LernLab does not save an exam's mode or the pass mark it had, so the assistant sees the deck's pass mark as it is now.

### Study aids for your cards

The assistant can suggest, for a card you already have:

| Suggestion | For which cards | Limits |
|---|---|---|
| Other ways to ask the question (variants), each marked recall, apply or analyse | Cards you answer in writing (not cloze, multiple-choice, order, code, myth, explain, compare or worked cards) | 8 questions of 500 characters |
| Why each wrong choice is wrong (corrections) | Multiple-choice cards; right choices never get one | 500 characters each |
| Key points, and a model explanation as the back | Explain cards | 2 to 5 points of 300 characters |
| What to learn first (cards or `#tags` of the same deck) | Any card | 10 names of 200 characters |
| A memory aid | Any card | 300 characters |
| Key terms | Cards with a written answer; only words that stand in the back | 5 terms of 100 characters |

What the assistant sends is untrusted, like a deck from a stranger. LernLab cleans it with the same code that reads imported decks: plain text only (formatting, HTML and scripts are removed), repeats and blanks dropped, everything cut to the limits above. A suggestion that does not fit the card (corrections for a card without choices, key points for a card that is not an explain card) is refused, and a suggestion never turns a card into another type. Under **AI requests** each card is its own request: every suggested field shows what the card has now above the suggestion, lists one entry per line, and corrections one row per wrong choice. Edit it, then **Save the fix**, or **Decline**. Nothing is saved before you accept, and accepting is not a review: the card's schedule, progress and answer history stay exactly as they were.
