# shellcheck shell=bash
##
# warppcs profile of ~/scripts/bootstrap, sourced by it once the dotfiles are
# checked out. Uses the main script's helpers (step, install_flatpaks).
#
# Steam is the system package rather than the flatpak: builds with the `steam`
# feature talk to the running client through ~/.steam, which the flatpak keeps
# inside its sandbox.

WARPPCS_APT_PACKAGES=(steam-installer clang libasound2-dev libudev-dev libwayland-dev libxkbcommon-dev)

WARPPCS_FLATPAKS=(com.discordapp.Discord)

WARPPCS_DIR="$HOME/development/warppcs"

ASEPRITE_STEAM_APP=431730

##
# Opens Steam's install dialog for Aseprite (bought on Steam, launched by
# ~/scripts/warppcs/aseprite) unless it is installed already. Steam runs
# detached, so on a fresh machine the install finishes after logging in there.
warppcs_aseprite() {
  [ -f "$HOME/.steam/steam/steamapps/appmanifest_$ASEPRITE_STEAM_APP.acf" ] && return
  nohup steam "steam://install/$ASEPRITE_STEAM_APP" >/dev/null 2>&1 &
  NEXT_STEPS+=("confirm the Aseprite install in Steam (log in first if asked)")
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
