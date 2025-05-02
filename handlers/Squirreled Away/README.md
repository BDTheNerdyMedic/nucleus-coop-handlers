# Squirreled Away - Nucleus Co-op Handler

## Game and Handler Information
- **Game:** Squirreled Away
- **Handler Version:** 3
- **Author:** BDTheNerdyMedic
- **Created:** April 27, 2025
- **Last Updated:** May 2, 2025

## Game Details
- **Engine:** Unreal Engine 5
- **Multiplayer:** Steam LAN co-op, up to 4 players
- **Executable:** `SquirrelGame-Win64-Shipping.exe`
- **Input:** Partial controller support (XInput) with keyboard/mouse for menus
- **Config:** `%LocalAppData%\SquirrelGame\Saved\Config\Windows\GameUserSettings.ini`

## Setup Instructions
1. Add Squirreled Away in Nucleus, selecting `SquirrelGame-Win64-Shipping.exe` in `SquirrelGame\Binaries\Win64`.
2. Assign XInput controllers and keyboard/mouse to players. Use keyboard/mouse for menus if needed (press `End` to lock/unlock input).
3. Host a LAN session in one instance, then join from others.

## Known Issues
- Partial controller support may require keyboard/mouse for menus.

## Notes
- Uses Goldberg Emulator for Steam LAN co-op.
- Config files are copied per instance to avoid conflicts.