# NetCmd

A minimal copy-paste tool for network engineers. Not a knowledge base, not a terminal — just the commands you already know, one click away.

**Find. Fill. Copy.**

## What it does

- Built-in commands grouped by category (华三 = light red tint, NVIDIA IB = light green tint). Add your own categories with eye-friendly colors.
- No-parameter commands: **1 click → clipboard.**
- Commands with `{placeholders}` (e.g. `{peer}`, `{interface}`): **click anywhere to copy immediately** — unfilled params keep their `{placeholder}`. Or click an orange `{placeholder}` to fill it in place, press **Enter** to copy the final command.
- Drag rows to reorder commands (across categories too), drag category headers to reorder categories. Right-click a category header for actions (clear / delete).
- **Data (YAML)** box at the bottom: view, edit, download or load a `.yaml` file and replace everything in one click — the easy way to move your setup to another machine.
- Add your own templates (Name is optional, only Template is required). Everything is saved in your browser's localStorage and survives refresh. Any command can be deleted (two-step "Sure?" confirm), and the name column can be hidden.

## Run

Open `index.html` in a browser. That's it.
