# shellcheck shell=bash
##
# warppcs profile of ~/scripts/bootstrap, sourced by it once the dotfiles are
# checked out. Uses the main script's helpers (step, install_flatpaks).
#
# Steam is the system package rather than the flatpak: builds with the `steam`
# feature talk to the running client through ~/.steam, which the flatpak keeps
# inside its sandbox.

# xvfb, x11-utils (xwininfo) and mesa-vulkan-drivers (lavapipe) run the game
# off-screen for scripts/screenshot.sh.
WARPPCS_APT_PACKAGES=(steam-installer clang libasound2-dev libudev-dev libwayland-dev libxkbcommon-dev
  xvfb x11-utils mesa-vulkan-drivers)

WARPPCS_FLATPAKS=(com.discordapp.Discord)

WARPPCS_DIR="$HOME/development/warppcs"

ASEPRITE_STEAM_APP=431730

##
# Writes the Aseprite app-menu entry so it starts the binary directly through
# ~/scripts/warppcs/aseprite. Steam's own shortcut for the same file name goes
# through the client, which then has to be running and logged in, and its icon
# stops at 64px. The icons come from the install itself in every size it ships,
# and StartupWMClass matches the window's WM_CLASS so the dock groups the
# running window under this entry.
warppcs_aseprite_launcher() {
  local icons="$HOME/.steam/steam/steamapps/common/Aseprite/data/icons"
  local hicolor="$HOME/.local/share/icons/hicolor"
  local png size
  for png in "$icons"/ase[0-9]*.png; do
    size="${png##*/ase}"
    size="${size%.png}"
    install -D -m 644 "$png" "$hicolor/${size}x${size}/apps/aseprite.png"
  done
  install -D -m 644 "$icons/hd/asehd.png" "$hicolor/512x512/apps/aseprite.png"
  gtk-update-icon-cache -q -t "$hicolor" 2>/dev/null || true

  mkdir -p "$HOME/.local/share/applications"
  cat >"$HOME/.local/share/applications/Aseprite.desktop" <<EOF
[Desktop Entry]
Name=Aseprite
Comment=Animated sprite editor and pixel art tool
Exec=$HOME/scripts/warppcs/aseprite
Icon=aseprite
StartupWMClass=Aseprite
Terminal=false
Type=Application
Categories=Graphics;
EOF
}

##
# Opens Steam's install dialog for Aseprite (bought on Steam, launched by
# ~/scripts/warppcs/aseprite) unless it is installed already, in which case it
# writes the launcher. Steam drops an install URL it receives while logged out,
# so before the first login this only asks for one and a re-run opens the
# dialog.
warppcs_aseprite() {
  local steam_dir="$HOME/.steam/steam"
  if [ -f "$steam_dir/steamapps/appmanifest_$ASEPRITE_STEAM_APP.acf" ]; then
    warppcs_aseprite_launcher
    return
  fi
  if ! grep -q '"AccountName"' "$steam_dir/config/loginusers.vdf" 2>/dev/null; then
    NEXT_STEPS+=("log in to Steam (run steam), then re-run bootstrap to install Aseprite")
    return
  fi
  nohup steam "steam://install/$ASEPRITE_STEAM_APP" >/dev/null 2>&1 &
  NEXT_STEPS+=("confirm the Aseprite install in Steam, then re-run bootstrap to set up its launcher")
}

setup_warppcs() {
  step "warppcs"
  if ! dpkg --print-foreign-architectures | grep -qx i386; then
    sudo dpkg --add-architecture i386
    sudo apt-get update
  fi
  sudo apt-get install -y "${WARPPCS_APT_PACKAGES[@]}"
  install_flatpaks "${WARPPCS_FLATPAKS[@]}"
  mkdir -p "$(dirname "$WARPPCS_DIR")"
  [ -d "$WARPPCS_DIR" ] || git clone git@github.com:glklimmer/warppcs.git "$WARPPCS_DIR"
  warppcs_aseprite
}
